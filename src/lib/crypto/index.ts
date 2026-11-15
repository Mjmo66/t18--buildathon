/**
 * End-to-end encryption for chat: NaCl `box` (X25519 key agreement + XSalsa20-Poly1305).
 *
 * - Each user has one key pair. The public key is published in `profiles.public_key`
 *   (base64); the secret key never leaves the device (localStorage
 *   in the browser). Never upload or log the secret key.
 * - Each message gets a fresh random 24-byte nonce. The server stores only
 *   `ciphertext` + `nonce` (both base64).
 * - `box` is symmetric between the two parties: box(peerPub, mySecret) and
 *   box(myPub, peerSecret) derive the same shared key. So the sender can decrypt
 *   their own sent messages with the peer's public key and their own secret key.
 *
 * Known limits (demo):
 * - The secret key lives on one device / browser profile. Signing in on a new device
 *   (or clearing site data) creates a new key pair, replaces `profiles.public_key`,
 *   and older messages can no longer be decrypted on either side
 *   (they show as "undecryptable"). There is no key backup or multi-device sync.
 * - No key verification UI is enforced; `publicKeyFingerprint` lets two people compare
 *   keys out of band. The server could swap a public key (MITM) and nobody would notice
 *   unless they compare fingerprints.
 * - On web the key sits in localStorage, so an XSS on the origin could read it.
 */
import './prng';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

// tweetnacl-util is CommonJS: use the default import (named ESM imports fail outside bundlers).
const { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } = naclUtil;
import { getSecretKey, setSecretKey } from './keystore';
import { demoKeyPair } from './demoKeys.js';

export interface KeyPair {
  /** base64, 32 bytes; safe to publish */
  publicKey: string;
  /** raw 32 bytes; keep on device */
  secretKey: Uint8Array;
}

export interface EncryptedPayload {
  /** base64 */
  ciphertext: string;
  /** base64, 24 bytes */
  nonce: string;
}

/** Use the platform's WebCrypto getRandomValues (polyfilled on native) for tweetnacl,
 *  regardless of whether tweetnacl found a PRNG when it was first loaded. */
let prngReady = false;
function ensurePrng(): void {
  if (prngReady) return;
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const getRandomValues = c.getRandomValues.bind(c);
    nacl.setPRNG((out: Uint8Array, n: number) => {
      const QUOTA = 65536;
      const v = new Uint8Array(n);
      for (let i = 0; i < n; i += QUOTA) getRandomValues(v.subarray(i, Math.min(i + QUOTA, n)));
      out.set(v);
      v.fill(0);
    });
  }
  // else: keep tweetnacl's own PRNG (Node `crypto`); it throws "no PRNG" if there is none.
  prngReady = true;
}

const inflight = new Map<string, Promise<KeyPair>>();

/** Load this user's key pair from the device keystore, or create and store a new one. */
export function getOrCreateKeyPair(userId: string): Promise<KeyPair> {
  const existing = inflight.get(userId);
  if (existing) return existing;
  const p = (async () => {
    const stored = await getSecretKey(userId);
    if (stored && stored.length === nacl.box.secretKeyLength) {
      const kp = nacl.box.keyPair.fromSecretKey(stored);
      return { publicKey: encodeBase64(kp.publicKey), secretKey: kp.secretKey };
    }
    ensurePrng();
    const kp = nacl.box.keyPair();
    await setSecretKey(userId, kp.secretKey);
    return { publicKey: encodeBase64(kp.publicKey), secretKey: kp.secretKey };
  })();
  inflight.set(userId, p);
  // Cache only successes; let a failed attempt be retried.
  p.catch(() => inflight.delete(userId));
  return p;
}

/** Seeded demo accounts use a fixed key pair (see demoKeys.js) so their seeded chats open on
 *  any device. Call right after sign-in, before anything reads the key; replaces a random key
 *  this device may have stored earlier. Does nothing for other accounts. */
export function installDemoKey(userId: string, email: string | null | undefined): void {
  const kp = demoKeyPair(email);
  if (!kp) return;
  try {
    void setSecretKey(userId, kp.secretKey); // synchronous localStorage write
  } catch {
    return;
  }
  inflight.delete(userId);
}

/** Fresh random key pair, not stored anywhere (tests, tooling). */
export function generateKeyPair(): KeyPair {
  ensurePrng();
  const kp = nacl.box.keyPair();
  return { publicKey: encodeBase64(kp.publicKey), secretKey: kp.secretKey };
}

function decodePublicKey(b64: string): Uint8Array {
  let pk: Uint8Array;
  try {
    pk = decodeBase64(b64);
  } catch {
    throw new Error('Invalid public key (not base64)');
  }
  if (pk.length !== nacl.box.publicKeyLength) throw new Error('Invalid public key length');
  return pk;
}

/** Encrypt `plaintext` for the holder of `theirPublicKeyB64`. Throws on an invalid key. */
export function encryptFor(
  theirPublicKeyB64: string,
  plaintext: string,
  mySecretKey: Uint8Array,
): EncryptedPayload {
  const theirPk = decodePublicKey(theirPublicKeyB64);
  if (mySecretKey.length !== nacl.box.secretKeyLength) throw new Error('Invalid secret key length');
  ensurePrng();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box(decodeUTF8(plaintext), nonce, theirPk, mySecretKey);
  return { ciphertext: encodeBase64(box), nonce: encodeBase64(nonce) };
}

/** Decrypt a message exchanged with `theirPublicKeyB64`. Returns null on any failure
 *  (bad base64, wrong lengths, wrong key, tampering, invalid UTF-8); never throws. */
export function decryptFrom(
  theirPublicKeyB64: string,
  payload: EncryptedPayload,
  mySecretKey: Uint8Array,
): string | null {
  try {
    const theirPk = decodeBase64(theirPublicKeyB64);
    const nonce = decodeBase64(payload.nonce);
    const box = decodeBase64(payload.ciphertext);
    if (
      theirPk.length !== nacl.box.publicKeyLength ||
      nonce.length !== nacl.box.nonceLength ||
      mySecretKey.length !== nacl.box.secretKeyLength ||
      box.length < nacl.box.overheadLength
    ) {
      return null;
    }
    const opened = nacl.box.open(box, nonce, theirPk, mySecretKey);
    return opened ? encodeUTF8(opened) : null;
  } catch {
    return null;
  }
}

/** Short human-checkable fingerprint: first 8 bytes of SHA-512(public key) as
 *  4 groups of 4 hex chars, e.g. "3f2a 9c01 be77 0d4e". Returns "invalid key" on bad input. */
export function publicKeyFingerprint(pubB64: string): string {
  try {
    const hash = nacl.hash(decodePublicKey(pubB64)).subarray(0, 8);
    const hex = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
    return hex.match(/.{4}/g)!.join(' ');
  } catch {
    return 'invalid key';
  }
}
