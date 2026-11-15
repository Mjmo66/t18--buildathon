import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext.jsx';
import { Button, ConfirmDialog } from './ui/index.js';

// Full-width "Sign out" for the bottom of a Profile page. Asks first.
export default function SignOutButton() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doSignOut() {
    setBusy(true);
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <>
      <Button variant="secondary" block icon={<LogOut size={20} aria-hidden="true" />} onClick={() => setAsking(true)}>
        Sign out
      </Button>
      <ConfirmDialog
        open={asking}
        title="Sign out of Kindred?"
        confirmLabel="Yes, sign out"
        cancelLabel="No, stay signed in"
        busy={busy}
        onConfirm={doSignOut}
        onCancel={() => setAsking(false)}
      >
        You can sign in again at any time.
      </ConfirmDialog>
    </>
  );
}
