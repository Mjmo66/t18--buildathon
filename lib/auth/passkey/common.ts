// Shared passkey flow: talks to the `passkey` edge function and turns its result into a
// Supabase session. The platform files supply only the WebAuthn ceremony (create / get).
import { supabase } from '../../supabase';

export type Role = 'charity' | 'volunteer';
export interface SignUpInput {
  email: string;
  displayName: string;
  role: Role;
}

// JSON forms as produced by @simplewebauthn/server (base64url strings for binary fields).
// Kept loose here so this file does not depend on either platform library.
export type CreationOptionsJSON = Record<string, unknown> & { challenge: string };
export type RequestOptionsJSON = Record<string, unknown> & { challenge: string };
export type CredentialJSON = Record<string, unknown> & { id: string };

export interface Ceremony {
  create(options: CreationOptionsJSON): Promise<CredentialJSON>;
  get(options: RequestOptionsJSON): Promise<CredentialJSON>;
}

export class PasskeyError extends Error {
  constructor(message: string, readonly cancelled = false) {
    super(message);
    this.name = 'PasskeyError';
  }
}

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/passkey`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function call<T>(route: string, body: unknown, accessToken?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${FUNCTION_URL}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken ?? ANON_KEY}`,
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new PasskeyError('Could not reach the server. Check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new PasskeyError(typeof data?.error === 'string' ? data.error : 'Passkey request failed');
  return data as T;
}

async function startSession(s: { token_hash: string }): Promise<void> {
  // 'email' is the current type for magic-link token hashes; 'magiclink' is the older alias.
  // A failed verify does not consume the token, so the fallback is safe.
  let { error } = await supabase.auth.verifyOtp({ token_hash: s.token_hash, type: 'email' });
  if (error) ({ error } = await supabase.auth.verifyOtp({ token_hash: s.token_hash, type: 'magiclink' }));
  if (error) throw new PasskeyError('Signed in with your passkey, but the session could not start. Try again.');
}

/** Maps WebAuthn / native errors to a short message for the UI. */
export function friendlyError(e: unknown): PasskeyError {
  if (e instanceof PasskeyError) return e;
  const err = (e ?? {}) as { name?: string; code?: string; error?: string; message?: string };
  const kind = err.error ?? err.name ?? '';
  if (
    kind === 'NotAllowedError' ||
    kind === 'AbortError' ||
    kind === 'UserCancelled' ||
    err.code === 'ERROR_CEREMONY_ABORTED'
  ) {
    return new PasskeyError('Passkey cancelled.', true);
  }
  if (kind === 'InvalidStateError' || kind === 'CredentialAlreadyExists' || err.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
    return new PasskeyError('This device already has a passkey for this account.');
  }
  if (kind === 'NoCredentials') return new PasskeyError('No passkey for this app on this device.');
  if (kind === 'TimedOut') return new PasskeyError('Passkey timed out. Try again.');
  if (kind === 'NotSupported' || kind === 'NotSupportedError') {
    return new PasskeyError('Passkeys are not available here. Use email and password.');
  }
  if (kind === 'SecurityError' || kind === 'BadConfiguration' || err.code === 'ERROR_INVALID_RP_ID' || err.code === 'ERROR_INVALID_DOMAIN') {
    return new PasskeyError('Passkeys are not set up for this address.');
  }
  return new PasskeyError('Passkey failed. Try again or use email and password.');
}

async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw friendlyError(e);
  }
}

export function makePasskeyApi(ceremony: Ceremony) {
  return {
    signUpWithPasskey: (input: SignUpInput) =>
      guarded(async () => {
        const { options, challengeId } = await call<{ options: CreationOptionsJSON; challengeId: string }>(
          '/register/options',
          { email: input.email.trim(), displayName: input.displayName.trim(), role: input.role },
        );
        const response = await ceremony.create(options);
        await startSession(await call('/register/verify', { challengeId, response }));
      }),

    signInWithPasskey: (email?: string) =>
      guarded(async () => {
        const { options, challengeId } = await call<{ options: RequestOptionsJSON; challengeId: string }>(
          '/login/options',
          email?.trim() ? { email: email.trim() } : {},
        );
        const response = await ceremony.get(options);
        await startSession(await call('/login/verify', { challengeId, response }));
      }),

    addPasskeyToCurrentUser: () =>
      guarded(async () => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new PasskeyError('Sign in first.');
        const { options, challengeId } = await call<{ options: CreationOptionsJSON; challengeId: string }>(
          '/register/options',
          {},
          token,
        );
        const response = await ceremony.create(options);
        // Adding a passkey returns a fresh session for the same user; keep the current one.
        await call('/register/verify', { challengeId, response });
      }),
  };
}
