import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandHeart, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { installDemoKey } from '../../lib/crypto';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { Alert, Button } from '../../components/ui/index.js';
import { errorMessage } from './usePasskeySupport.js';
import { DEMO_CHARITY, DEMO_VOLUNTEER } from './demo.js';

/** One tap: sign in as a seeded demo account (fictional, already verified). */
export default function DemoButtons() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function signIn(which, creds) {
    setError('');
    setBusy(which);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword(creds);
      if (err) throw err;
      if (data.user) installDemoKey(data.user.id, data.user.email);
      await refreshProfile();
      navigate('/', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="demo-buttons">
        <Button variant="secondary" block loading={busy === 'charity'} disabled={busy !== null}
          onClick={() => signIn('charity', DEMO_CHARITY)}
          icon={<HandHeart size={20} strokeWidth={2} aria-hidden="true" />}
          hint="Sign in as East Neuk Beach Guardians (demo), a verified charity.">
          Demo charity
        </Button>
        <Button variant="secondary" block loading={busy === 'volunteer'} disabled={busy !== null}
          onClick={() => signIn('volunteer', DEMO_VOLUNTEER)}
          icon={<User size={20} strokeWidth={2} aria-hidden="true" />}
          hint="Sign in as Isla Murray (demo), a volunteer.">
          Demo volunteer
        </Button>
      </div>
    </>
  );
}
