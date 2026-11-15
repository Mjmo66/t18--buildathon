// iOS/Android keystore: the secret key is kept in the Keychain / Keystore via expo-secure-store.
import * as SecureStore from 'expo-secure-store';
import naclUtil from 'tweetnacl-util';

// tweetnacl-util is CommonJS: use the default import (named ESM imports fail outside bundlers).
const { decodeBase64, encodeBase64 } = naclUtil;

// SecureStore keys allow only [A-Za-z0-9._-]; user ids are UUIDs, so this is safe.
const storageKey = (userId: string) => `e2e_sk_${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

export async function getSecretKey(userId: string): Promise<Uint8Array | null> {
  try {
    const v = await SecureStore.getItemAsync(storageKey(userId));
    if (!v) return null;
    const k = decodeBase64(v);
    return k.length === 32 ? k : null;
  } catch {
    return null;
  }
}

export async function setSecretKey(userId: string, key: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(storageKey(userId), encodeBase64(key), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
