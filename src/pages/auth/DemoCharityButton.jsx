import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandHeart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { Alert, Button } from '../../components/ui/index.js';
import { errorMessage } from './usePasskeySupport.js';
import { DEMO_CHARITY } from './demo.js';

/** One tap: sign in as the seeded, already verified demo charity. */
export default function DemoCharityButton() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    setError('');
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword(DEMO_CHARITY);
      if (err) throw err;
      await refreshProfile();
      navigate('/', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button variant="secondary" block loading={busy} onClick={signIn}
        icon={<HandHeart size={20} strokeWidth={2} aria-hidden="true" />}
        hint="Sign in as East Neuk Beach Guardians, a verified demo charity.">
        Try the demo charity
      </Button>
    </>
  );
}
