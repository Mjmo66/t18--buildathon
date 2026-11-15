// iOS / Android: platform passkeys through react-native-passkey. Needs a development build with
// associated domains (see docs/passkeys.md). In Expo Go the native module is missing, so
// isPasskeySupported() returns false and the UI falls back to email + password.
import { NativeModules } from 'react-native';
import { Passkey, type PasskeyCreateRequest, type PasskeyGetRequest } from 'react-native-passkey';
import { makePasskeyApi, PasskeyError, type CredentialJSON, type SignUpInput } from './common';

export { PasskeyError } from './common';

function nativeAvailable(): boolean {
  try {
    return Boolean(NativeModules.Passkey) && Passkey.isSupported();
  } catch {
    return false;
  }
}

// The server returns @simplewebauthn/server JSON; the verifier expects these fields present.
function withDefaults(result: object): CredentialJSON {
  const r = result as CredentialJSON;
  return { type: 'public-key', clientExtensionResults: {}, ...r, rawId: (r.rawId as string) ?? r.id };
}

const api = makePasskeyApi({
  create: async (options) => {
    if (!nativeAvailable()) throw new PasskeyError('Passkeys need the installed app, not Expo Go.');
    return withDefaults(await Passkey.create(options as unknown as PasskeyCreateRequest));
  },
  get: async (options) => {
    if (!nativeAvailable()) throw new PasskeyError('Passkeys need the installed app, not Expo Go.');
    return withDefaults(await Passkey.get(options as unknown as PasskeyGetRequest));
  },
});

export async function isPasskeySupported(): Promise<boolean> {
  return nativeAvailable();
}

export const signUpWithPasskey: (input: SignUpInput) => Promise<void> = api.signUpWithPasskey;
export const signInWithPasskey: (email?: string) => Promise<void> = api.signInWithPasskey;
export const addPasskeyToCurrentUser: () => Promise<void> = api.addPasskeyToCurrentUser;
