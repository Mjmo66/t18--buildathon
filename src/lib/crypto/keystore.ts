// Web keystore: localStorage (per browser profile). Readable by any script on this origin,
// so an XSS on the site could steal the key; acceptable for the demo, noted in index.ts.
import naclUtil from 'tweetnacl-util';

// tweetnacl-util is CommonJS: use the default import (named ESM imports fail outside bundlers).
const { decodeBase64, encodeBase64 } = naclUtil;

const storageKey = (userId: string) => `e2e_sk_${userId}`;

export async function getSecretKey(userId: string): Promise<Uint8Array | null> {
  try {
    const v = globalThis.localStorage?.getItem(storageKey(userId));
    if (!v) return null;
    const k = decodeBase64(v);
    return k.length === 32 ? k : null;
  } catch {
    return null;
  }
}

export async function setSecretKey(userId: string, key: Uint8Array): Promise<void> {
  globalThis.localStorage.setItem(storageKey(userId), encodeBase64(key));
}
