// Web: WebAuthn through @simplewebauthn/browser. Works on https and on http://localhost.
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { makePasskeyApi, type CredentialJSON, type SignUpInput } from './common';

export { PasskeyError } from './common';

const api = makePasskeyApi({
  create: async (options) =>
    (await startRegistration({
      optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
    })) as unknown as CredentialJSON,
  get: async (options) =>
    (await startAuthentication({
      optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
    })) as unknown as CredentialJSON,
});

export async function isPasskeySupported(): Promise<boolean> {
  try {
    return typeof window !== 'undefined' && window.isSecureContext && browserSupportsWebAuthn();
  } catch {
    return false;
  }
}

export const signUpWithPasskey: (input: SignUpInput) => Promise<void> = api.signUpWithPasskey;
export const signInWithPasskey: (email?: string) => Promise<void> = api.signInWithPasskey;
export const addPasskeyToCurrentUser: () => Promise<void> = api.addPasskeyToCurrentUser;
