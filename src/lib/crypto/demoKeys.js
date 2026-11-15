// Fixed E2E chat keys for the seeded, fictional demo accounts (scripts/seed.mjs).
// The seed encrypts demo conversations with these keys, and the app installs the same key
// on any device that signs in as a demo account, so the seeded chats open everywhere.
// These secret keys are public on purpose: never use this for a real account. Only the
// exact addresses below get one, not every address at the demo domain.
import nacl from 'tweetnacl';

export const DEMO_DOMAIN = 'demo.kindred.uk';
export const DEMO_CHARITY_LOCALS = ['beachguardians', 'foodshare', 'companions', 'readingbuddies', 'harbourpaws', 'warmspaces'];
export const DEMO_VOLUNTEER_LOCALS = ['isla', 'ewan', 'priya', 'tom', 'sofia', 'jamie', 'hannah', 'leo'];

const DEMO_EMAILS = new Set(
  [...DEMO_CHARITY_LOCALS, ...DEMO_VOLUNTEER_LOCALS].map((l) => `${l}@${DEMO_DOMAIN}`),
);

export function isDemoEmail(email) {
  return typeof email === 'string' && DEMO_EMAILS.has(email.trim().toLowerCase());
}

/** The demo account's fixed NaCl box key pair, or null for any other address. */
export function demoKeyPair(email) {
  if (!isDemoEmail(email)) return null;
  const seed = nacl.hash(new TextEncoder().encode(`kindred-demo:${email.trim().toLowerCase()}`)).slice(0, 32);
  return nacl.box.keyPair.fromSecretKey(seed);
}
