import { useEffect, useState } from 'react';
import { isPasskeySupported } from '../../lib/auth/passkey';

/** null while checking, then true / false. */
export function usePasskeySupport() {
  const [supported, setSupported] = useState(null);
  useEffect(() => {
    let alive = true;
    isPasskeySupported().then((ok) => alive && setSupported(ok));
    return () => {
      alive = false;
    };
  }, []);
  return supported;
}

/** Message for any error thrown by passkey or Supabase auth calls. */
export function errorMessage(e) {
  if (e && typeof e === 'object' && 'message' in e && e.message) return String(e.message);
  return 'Something went wrong. Try again.';
}
