// Type entry point and fallback. Metro picks index.web.ts or index.native.ts at bundle time;
// TypeScript and any other platform resolve this file, which reports passkeys as unsupported.
import { PasskeyError, type SignUpInput } from './common';

export { PasskeyError } from './common';

const unsupported = async (): Promise<never> => {
  throw new PasskeyError('Passkeys are not available here. Use email and password.');
};

export async function isPasskeySupported(): Promise<boolean> {
  return false;
}
export const signUpWithPasskey: (input: SignUpInput) => Promise<void> = unsupported;
export const signInWithPasskey: (email?: string) => Promise<void> = unsupported;
export const addPasskeyToCurrentUser: () => Promise<void> = unsupported;
