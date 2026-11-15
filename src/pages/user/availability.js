// Volunteer "You're ON / OFF" switch (Lovable design). Kept in this browser only for the demo:
// when off, the Board shows no requests. Shared by the Board and Profile screens.
import { useEffect, useState } from 'react';

const KEY = 'kindred.available';
const listeners = new Set();

function read() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function useAvailability() {
  const [on, setOn] = useState(read);
  useEffect(() => {
    listeners.add(setOn);
    return () => { listeners.delete(setOn); };
  }, []);
  const set = (value) => {
    try { localStorage.setItem(KEY, value ? 'on' : 'off'); } catch { /* private mode */ }
    listeners.forEach((l) => l(value));
  };
  return [on, set];
}
