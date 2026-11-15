// Request handling for the `passkey` edge function, kept free of Deno globals and of the
// Supabase client so it can be unit-tested with a fake store (see handler.test.ts).
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from 'npm:@simplewebauthn/server@14.0.3';

export type Role = 'charity' | 'volunteer';

export interface PendingAccount {
  user_id: string; // pre-generated auth user id, also the WebAuthn user handle
  email: string;
  display_name: string;
  role: Role;
}

export interface ChallengeRow {
  id: string;
  challenge: string;
  kind: 'register' | 'login';
  user_id: string | null;
  pending: PendingAccount | null;
  expires_at: string;
}

export interface CredentialRow {
  id: string;
  user_id: string;
  public_key: string; // base64url
  counter: number;
  transports: string[];
}

export interface Session {
  token_hash: string;
  email: string;
}

/** Everything the handler needs from Supabase. index.ts implements it with the service role. */
export interface Store {
  userFromAccessToken(token: string): Promise<{ id: string; email: string } | null>;
  emailTaken(email: string): Promise<boolean>;
  userIdByEmail(email: string): Promise<string | null>;
  emailOfUser(userId: string): Promise<string | null>;
  saveChallenge(row: Omit<ChallengeRow, 'id' | 'expires_at'>): Promise<string>;
  /** Deletes the challenge and returns it (single use). */
  takeChallenge(id: string): Promise<ChallengeRow | null>;
  purgeExpiredChallenges(): Promise<void>;
  credentialsOfUser(userId: string): Promise<CredentialRow[]>;
  credential(id: string): Promise<CredentialRow | null>;
  insertCredential(row: CredentialRow): Promise<void>;
  updateCounter(id: string, counter: number): Promise<void>;
  /** Throws EmailTakenError when the address is already registered. */
  createUser(p: PendingAccount): Promise<void>;
  deleteUser(id: string): Promise<void>;
  mintSession(email: string): Promise<Session>;
}

export interface WebAuthn {
  generateRegistrationOptions: typeof generateRegistrationOptions;
  verifyRegistrationResponse: typeof verifyRegistrationResponse;
  generateAuthenticationOptions: typeof generateAuthenticationOptions;
  verifyAuthenticationResponse: typeof verifyAuthenticationResponse;
}

export interface Config {
  rpIDs: string[]; // first one is the default (native apps send no Origin header)
  rpName: string;
  origins: string[]; // expected WebAuthn origins (web origins + android:apk-key-hash:...)
}

export class EmailTakenError extends Error {}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function corsHeaders(req: Request, cfg: Config): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  const origin = req.headers.get('Origin');
  if (origin && cfg.origins.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

/** RP ID for this request: the configured RP ID that the caller's origin belongs to. */
function rpIdFor(req: Request, cfg: Config): string {
  const origin = req.headers.get('Origin');
  if (origin && cfg.origins.includes(origin)) {
    try {
      const host = new URL(origin).hostname;
      const match = cfg.rpIDs.find((id) => host === id || host.endsWith(`.${id}`));
      if (match) return match;
    } catch { /* not a URL */ }
  }
  return cfg.rpIDs[0];
}

function bearer(req: Request): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '');
  return m ? m[1].trim() : null;
}

function str(v: unknown, field: string, max = 320): string {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${field} is required`);
  const s = v.trim();
  if (s.length > max) throw new HttpError(400, `${field} is too long`);
  return s;
}

export function createHandler(store: Store, wa: WebAuthn, cfg: Config) {
  async function challengeFor(id: unknown, kind: ChallengeRow['kind']): Promise<ChallengeRow> {
    if (typeof id !== 'string' || !UUID_RE.test(id)) throw new HttpError(400, 'challengeId is required');
    const row = await store.takeChallenge(id);
    if (!row || row.kind !== kind) throw new HttpError(400, 'Unknown or used challenge');
    if (Date.parse(row.expires_at) < Date.now()) throw new HttpError(400, 'Challenge expired, try again');
    return row;
  }

  async function registerOptions(req: Request, body: Record<string, unknown>) {
    let userId: string;
    let email: string;
    let displayName: string;
    let pending: PendingAccount | null = null;
    let exclude: CredentialRow[] = [];

    if (body.email !== undefined) {
      // New account. (supabase.functions.invoke always sends a Bearer header, often the anon
      // key, so the presence of `email` decides the mode, not the header.)
      email = str(body.email, 'email').toLowerCase();
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email');
      displayName = str(body.displayName, 'displayName', 80);
      const role = body.role;
      if (role !== 'charity' && role !== 'volunteer') throw new HttpError(400, 'role must be charity or volunteer');
      if (await store.emailTaken(email)) throw new HttpError(400, 'An account with this email already exists');
      userId = crypto.randomUUID();
      pending = { user_id: userId, email, display_name: displayName, role };
    } else {
      const token = bearer(req);
      const user = token ? await store.userFromAccessToken(token) : null;
      if (!user) throw new HttpError(401, 'Sign in first');
      userId = user.id;
      email = user.email;
      displayName = user.email;
      exclude = await store.credentialsOfUser(userId);
    }

    const options = await wa.generateRegistrationOptions({
      rpName: cfg.rpName,
      rpID: rpIdFor(req, cfg),
      userName: email,
      userDisplayName: displayName,
      userID: enc.encode(userId),
      attestationType: 'none',
      excludeCredentials: exclude.map((c) => ({ id: c.id, transports: c.transports })),
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
    });
    const challengeId = await store.saveChallenge({
      challenge: options.challenge,
      kind: 'register',
      user_id: pending ? null : userId,
      pending,
    });
    return { options, challengeId };
  }

  async function registerVerify(body: Record<string, unknown>) {
    const ch = await challengeFor(body.challengeId, 'register');
    const response = body.response as RegistrationResponseJSON;
    if (!response || typeof response !== 'object') throw new HttpError(400, 'response is required');

    let verification;
    try {
      verification = await wa.verifyRegistrationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: cfg.origins,
        expectedRPID: cfg.rpIDs,
        requireUserVerification: true,
      });
    } catch {
      throw new HttpError(400, 'Passkey could not be verified');
    }
    if (!verification.verified) throw new HttpError(400, 'Passkey could not be verified');
    const { credential } = verification.registrationInfo;

    if (await store.credential(credential.id)) throw new HttpError(400, 'This passkey is already registered');

    let userId: string;
    let email: string;
    let created = false;
    if (ch.pending) {
      try {
        await store.createUser(ch.pending);
      } catch (e) {
        if (e instanceof EmailTakenError) throw new HttpError(400, 'An account with this email already exists');
        throw e;
      }
      created = true;
      userId = ch.pending.user_id;
      email = ch.pending.email;
    } else if (ch.user_id) {
      userId = ch.user_id;
      const e = await store.emailOfUser(userId);
      if (!e) throw new HttpError(400, 'Account not found');
      email = e;
    } else {
      throw new HttpError(400, 'Unknown or used challenge');
    }

    try {
      await store.insertCredential({
        id: credential.id,
        user_id: userId,
        public_key: bytesToB64url(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? response.response?.transports ?? [],
      });
    } catch (e) {
      if (created) await store.deleteUser(userId).catch(() => {});
      throw e;
    }
    return await store.mintSession(email);
  }

  async function loginOptions(req: Request, body: Record<string, unknown>) {
    // Always a discoverable login: returning credential ids would reveal whether an email has an account.
    void body;
    const allow: CredentialRow[] = [];
    const options = await wa.generateAuthenticationOptions({
      rpID: rpIdFor(req, cfg),
      userVerification: 'required',
      allowCredentials: allow.map((c) => ({ id: c.id, transports: c.transports })),
    });
    const challengeId = await store.saveChallenge({
      challenge: options.challenge,
      kind: 'login',
      user_id: null,
      pending: null,
    });
    return { options, challengeId };
  }

  async function loginVerify(body: Record<string, unknown>) {
    const ch = await challengeFor(body.challengeId, 'login');
    const response = body.response as AuthenticationResponseJSON;
    if (!response || typeof response !== 'object' || typeof response.id !== 'string') {
      throw new HttpError(400, 'response is required');
    }
    const cred = await store.credential(response.id);
    if (!cred) throw new HttpError(400, 'This passkey is not registered here');

    let verification;
    try {
      verification = await wa.verifyAuthenticationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: cfg.origins,
        expectedRPID: cfg.rpIDs,
        credential: {
          id: cred.id,
          publicKey: b64urlToBytes(cred.public_key),
          counter: Number(cred.counter),
          transports: cred.transports,
        },
        requireUserVerification: true,
      });
    } catch {
      throw new HttpError(400, 'Passkey could not be verified');
    }
    if (!verification.verified) throw new HttpError(400, 'Passkey could not be verified');
    await store.updateCounter(cred.id, verification.authenticationInfo.newCounter);

    const email = await store.emailOfUser(cred.user_id);
    if (!email) throw new HttpError(400, 'Account not found');
    return await store.mintSession(email);
  }

  return async function handle(req: Request): Promise<Response> {
    const cors = corsHeaders(req, cfg);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    const json = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST');
      // Path is /functions/v1/passkey/<route> in production and /passkey/<route> locally.
      const route = new URL(req.url).pathname.replace(/^.*?\/passkey(?=\/|$)/, '').replace(/\/+$/, '');
      let body: Record<string, unknown>;
      try {
        const parsed = await req.json();
        body = parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        body = {};
      }
      store.purgeExpiredChallenges().catch(() => {});

      switch (route) {
        case '/register/options':
          return json(200, await registerOptions(req, body));
        case '/register/verify':
          return json(200, await registerVerify(body));
        case '/login/options':
          return json(200, await loginOptions(req, body));
        case '/login/verify':
          return json(200, await loginVerify(body));
        default:
          throw new HttpError(404, 'Not found');
      }
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error('passkey function error:', e instanceof Error ? e.message : e);
      return json(400, { error: 'Something went wrong, try again' });
    }
  };
}
