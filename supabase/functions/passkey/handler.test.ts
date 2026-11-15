// deno test --no-lock supabase/functions/passkey/handler.test.ts
// Request handling with a fake store and fake WebAuthn verification (no live project needed).
import { createHandler, EmailTakenError, type ChallengeRow, type CredentialRow, type PendingAccount, type Store, type WebAuthn } from './handler.ts';

function assert(cond: unknown, msg = 'assertion failed'): asserts cond {
  if (!cond) throw new Error(msg);
}
function eq<T>(a: T, b: T, msg = '') {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function fakeStore() {
  const users = new Map<string, { email: string; meta?: PendingAccount }>();
  const tokens = new Map<string, string>(); // access token -> user id
  const challenges = new Map<string, ChallengeRow>();
  const creds = new Map<string, CredentialRow>();
  let n = 0;
  const store: Store = {
    userFromAccessToken: async (t) => {
      const id = tokens.get(t);
      return id ? { id, email: users.get(id)!.email } : null;
    },
    emailTaken: async (e) => [...users.values()].some((u) => u.email === e),
    userIdByEmail: async (e) => [...users.entries()].find(([, u]) => u.email === e)?.[0] ?? null,
    emailOfUser: async (id) => users.get(id)?.email ?? null,
    saveChallenge: async (row) => {
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      challenges.set(id, { ...row, id, expires_at: new Date(Date.now() + 300_000).toISOString() });
      return id;
    },
    takeChallenge: async (id) => {
      const row = challenges.get(id) ?? null;
      challenges.delete(id);
      return row;
    },
    purgeExpiredChallenges: async () => {},
    credentialsOfUser: async (uid) => [...creds.values()].filter((c) => c.user_id === uid),
    credential: async (id) => creds.get(id) ?? null,
    insertCredential: async (row) => void creds.set(row.id, row),
    updateCounter: async (id, c) => void (creds.get(id)!.counter = c),
    createUser: async (p) => {
      if ([...users.values()].some((u) => u.email === p.email)) throw new EmailTakenError('exists');
      users.set(p.user_id, { email: p.email, meta: p });
    },
    deleteUser: async (id) => void users.delete(id),
    mintSession: async (email) => ({ token_hash: `hash-for-${email}`, email }),
  };
  return { store, users, tokens, challenges, creds };
}

const wa: WebAuthn = {
  generateRegistrationOptions: (async (o: { rpID: string; userID: Uint8Array; excludeCredentials?: unknown[]; authenticatorSelection?: unknown }) => ({
    challenge: 'reg-challenge',
    rp: { id: o.rpID },
    user: { id: new TextDecoder().decode(o.userID) },
    excludeCredentials: o.excludeCredentials,
    authenticatorSelection: o.authenticatorSelection,
  })) as unknown as WebAuthn['generateRegistrationOptions'],
  verifyRegistrationResponse: (async (o: { expectedChallenge: string; response: { id: string } }) => ({
    verified: o.expectedChallenge === 'reg-challenge',
    registrationInfo: { credential: { id: o.response.id, publicKey: new Uint8Array([1, 2, 3, 250]), counter: 0, transports: ['internal'] } },
  })) as unknown as WebAuthn['verifyRegistrationResponse'],
  generateAuthenticationOptions: (async (o: { rpID: string; allowCredentials?: unknown[] }) => ({
    challenge: 'login-challenge',
    rpId: o.rpID,
    allowCredentials: o.allowCredentials,
  })) as unknown as WebAuthn['generateAuthenticationOptions'],
  verifyAuthenticationResponse: (async (o: { expectedChallenge: string; credential: { publicKey: Uint8Array; counter: number } }) => {
    eq([...o.credential.publicKey], [1, 2, 3, 250], 'public key round trip');
    return { verified: o.expectedChallenge === 'login-challenge', authenticationInfo: { newCounter: o.credential.counter + 1 } };
  }) as unknown as WebAuthn['verifyAuthenticationResponse'],
};

const cfg = { rpIDs: ['kindred.pages.dev', 'localhost'], rpName: 'Test', origins: ['http://localhost:8081', 'https://kindred.pages.dev'] };

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://x/functions/v1/passkey${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8081', ...headers },
    body: JSON.stringify(body),
  });
}

Deno.test('new account: register, then sign in with the same passkey', async () => {
  const f = fakeStore();
  const handle = createHandler(f.store, wa, cfg);

  const r1 = await handle(post('/register/options', { email: 'Ana@Example.com', displayName: 'Ana', role: 'charity' }, { Authorization: 'Bearer anon-key' }));
  eq(r1.status, 200);
  eq(r1.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8081');
  const o1 = await r1.json();
  eq(o1.options.authenticatorSelection.residentKey, 'required');
  eq(o1.options.rp.id, 'localhost', 'RP ID follows the localhost origin');
  eq(f.users.size, 0, 'no user before verify');

  const r2 = await handle(post('/register/verify', { challengeId: o1.challengeId, response: { id: 'cred-1', response: {} } }));
  eq(r2.status, 200);
  eq(await r2.json(), { token_hash: 'hash-for-ana@example.com', email: 'ana@example.com' });
  const [uid, user] = [...f.users.entries()][0];
  eq(uid, o1.options.user.id, 'auth user id equals WebAuthn user handle');
  eq(user.meta?.role, 'charity');
  eq(user.meta?.display_name, 'Ana');
  eq(f.creds.get('cred-1')?.public_key, 'AQID-g', 'base64url public key');

  const r3 = await handle(post('/register/verify', { challengeId: o1.challengeId, response: { id: 'cred-1' } }));
  eq(r3.status, 400, 'challenge is single use');

  const r4 = await handle(post('/login/options', {}));
  const o4 = await r4.json();
  eq(o4.options.allowCredentials, [], 'discoverable login');
  const r5 = await handle(post('/login/verify', { challengeId: o4.challengeId, response: { id: 'cred-1' } }));
  eq(r5.status, 200);
  eq((await r5.json()).email, 'ana@example.com');
  eq(f.creds.get('cred-1')?.counter, 1, 'counter updated');
});

Deno.test('duplicate email is rejected at options time', async () => {
  const f = fakeStore();
  f.users.set('u1', { email: 'ana@example.com' });
  const handle = createHandler(f.store, wa, cfg);
  const r = await handle(post('/register/options', { email: 'ana@example.com', displayName: 'Ana', role: 'volunteer' }));
  eq(r.status, 400);
  assert(/already exists/.test((await r.json()).error));
});

Deno.test('bad input and unknown passkey give 400 with a short message', async () => {
  const f = fakeStore();
  const handle = createHandler(f.store, wa, cfg);
  for (const [path, body] of [
    ['/register/options', { email: 'nope', displayName: 'A', role: 'volunteer' }],
    ['/register/options', { email: 'a@b.co', displayName: 'A', role: 'admin' }],
    ['/register/verify', { challengeId: 'x', response: {} }],
    ['/login/verify', { challengeId: '00000000-0000-4000-8000-000000000099', response: { id: 'c' } }],
  ] as const) {
    const r = await handle(post(path, body));
    eq(r.status, 400, path);
    const j = await r.json();
    assert(typeof j.error === 'string' && !/\n\s+at /.test(j.error), 'no stack');
  }
  const lo = await (await handle(post('/login/options', { email: 'x@y.z' }))).json();
  const r = await handle(post('/login/verify', { challengeId: lo.challengeId, response: { id: 'unknown' } }));
  eq(r.status, 400);
});

Deno.test('add passkey to signed-in user needs a valid access token', async () => {
  const f = fakeStore();
  f.users.set('u1', { email: 'bo@example.com' });
  f.creds.set('old', { id: 'old', user_id: 'u1', public_key: 'AQID-g', counter: 0, transports: [] });
  f.tokens.set('good', 'u1');
  const handle = createHandler(f.store, wa, cfg);

  eq((await handle(post('/register/options', {}, { Authorization: 'Bearer anon-key' }))).status, 401);

  const o = await (await handle(post('/register/options', {}, { Authorization: 'Bearer good' }))).json();
  eq(o.options.excludeCredentials, [{ id: 'old', transports: [] }]);
  const r = await handle(post('/register/verify', { challengeId: o.challengeId, response: { id: 'new' } }));
  eq(r.status, 200);
  eq(f.creds.get('new')?.user_id, 'u1');
  eq(f.users.size, 1, 'no new user');
});

Deno.test('CORS preflight only echoes allowed origins', async () => {
  const handle = createHandler(fakeStore().store, wa, cfg);
  const ok = await handle(new Request('http://x/passkey/login/options', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081' } }));
  eq(ok.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8081');
  const bad = await handle(new Request('http://x/passkey/login/options', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }));
  eq(bad.headers.get('Access-Control-Allow-Origin'), null);
});

Deno.test('RP ID: hosted origin uses the hosted domain, no Origin (native) uses the first', async () => {
  const handle = createHandler(fakeStore().store, wa, cfg);
  const hosted = await (await handle(post('/login/options', {}, { Origin: 'https://kindred.pages.dev' }))).json();
  eq(hosted.options.rpId, 'kindred.pages.dev');
  const req = new Request('http://x/functions/v1/passkey/login/options', { method: 'POST', body: '{}' });
  eq((await (await handle(req)).json()).options.rpId, 'kindred.pages.dev');
  const evil = await (await handle(post('/login/options', {}, { Origin: 'http://localhost:9999' }))).json();
  eq(evil.options.rpId, 'kindred.pages.dev', 'unlisted origin gets the default');
});
