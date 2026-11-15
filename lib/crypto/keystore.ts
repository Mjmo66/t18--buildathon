// Fallback keystore (in memory), used by Node tests and type checking. Metro picks
// keystore.native.ts on iOS/Android and keystore.web.ts on web instead of this file.
// All three files share this interface.
export interface KeyStore {
  getSecretKey(userId: string): Promise<Uint8Array | null>;
  setSecretKey(userId: string, key: Uint8Array): Promise<void>;
}

const mem = new Map<string, Uint8Array>();

export async function getSecretKey(userId: string): Promise<Uint8Array | null> {
  const k = mem.get(userId);
  return k ? new Uint8Array(k) : null;
}

export async function setSecretKey(userId: string, key: Uint8Array): Promise<void> {
  mem.set(userId, new Uint8Array(key));
}
