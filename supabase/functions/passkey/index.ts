// Supabase Edge Function `passkey`: WebAuthn sign-up / sign-in that ends in a normal Supabase session.
// Deploy with `supabase functions deploy passkey --no-verify-jwt` (it serves anonymous callers).
// Routes and setup: docs/passkeys.md.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from 'npm:@simplewebauthn/server@14.0.3';
import { createHandler, EmailTakenError, type ChallengeRow, type CredentialRow, type Store } from './handler.ts';

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const store: Store = {
  async userFromAccessToken(token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  },
  async emailTaken(email) {
    return (await store.userIdByEmail(email)) !== null;
  },
  async userIdByEmail(email) {
    const row = check(
      await supabase.from('profiles').select('id').eq('email', email).limit(1).maybeSingle(),
    ) as { id: string } | null;
    return row?.id ?? null;
  },
  async emailOfUser(userId) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) return null;
    return data.user?.email ?? null;
  },
  async saveChallenge(row) {
    const saved = check(
      await supabase.from('passkey_challenges').insert(row).select('id').single(),
    ) as { id: string };
    return saved.id;
  },
  async takeChallenge(id) {
    return check(
      await supabase.from('passkey_challenges').delete().eq('id', id).select().maybeSingle(),
    ) as ChallengeRow | null;
  },
  async purgeExpiredChallenges() {
    check(await supabase.from('passkey_challenges').delete().lt('expires_at', new Date().toISOString()));
  },
  async credentialsOfUser(userId) {
    return (check(
      await supabase.from('passkey_credentials').select('id, user_id, public_key, counter, transports')
        .eq('user_id', userId),
    ) ?? []) as CredentialRow[];
  },
  async credential(id) {
    return check(
      await supabase.from('passkey_credentials').select('id, user_id, public_key, counter, transports')
        .eq('id', id).maybeSingle(),
    ) as CredentialRow | null;
  },
  async insertCredential(row) {
    check(await supabase.from('passkey_credentials').insert(row));
  },
  async updateCounter(id, counter) {
    check(await supabase.from('passkey_credentials').update({ counter }).eq('id', id));
  },
  async createUser(p) {
    const { error } = await supabase.auth.admin.createUser({
      id: p.user_id,
      email: p.email,
      email_confirm: true,
      user_metadata: { role: p.role, display_name: p.display_name },
    });
    if (error) {
      if (error.code === 'email_exists' || /already (been )?registered|already exists/i.test(error.message)) {
        throw new EmailTakenError(error.message);
      }
      throw new Error(error.message);
    }
  },
  async deleteUser(id) {
    await supabase.auth.admin.deleteUser(id);
  },
  async mintSession(email) {
    const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
    if (error || !data.properties?.hashed_token) throw new Error(error?.message ?? 'generateLink failed');
    return { token_hash: data.properties.hashed_token, email };
  },
};

const handle = createHandler(
  store,
  { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse },
  {
    rpIDs: env('RP_ID').split(',').map((s) => s.trim()).filter(Boolean),
    rpName: Deno.env.get('RP_NAME') ?? 'Kindred',
    origins: env('RP_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean),
  },
);

Deno.serve(handle);
