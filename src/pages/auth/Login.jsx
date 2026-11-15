import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { signInWithPasskey } from '../../lib/auth/passkey';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { Fingerprint, Mail } from 'lucide-react';
import { Alert, Button, Card, Field } from '../../components/ui/index.js';
import { usePasskeySupport, errorMessage } from './usePasskeySupport.js';
import PasswordField from './PasswordField.jsx';

const FACE_ID_HINT = "Your phone checks it's you. No password to remember.";

export default function Login() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const passkeys = usePasskeySupport();
  const [usePassword, setUsePassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const showPassword = usePassword || passkeys === false;

  async function done() {
    await refreshProfile();
    // PublicOnly on "/" sends the user on to their own space once the profile is loaded.
    navigate('/', { replace: true });
  }

  async function handlePasskey() {
    setError('');
    setBusy(true);
    try {
      await signInWithPasskey(email || undefined);
      await done();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePassword(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw err;
      await done();
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    setError('');
    setResetSent(false);
    if (!email.trim()) {
      setError('Type your email address above first, then press "Forgot password?" again.');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (err) throw err;
      setResetSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Sign in</h1>
      <Card>
        {error && <Alert tone="danger">{error}</Alert>}
        {resetSent && <Alert tone="success">We've emailed you a link to choose a new password.</Alert>}
        {showPassword ? (
          <form className="stack" onSubmit={handlePassword}>
            <Field label="Email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
            <PasswordField label="Password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" size="lg" block loading={busy}>Sign in</Button>
            <button type="button" className="link-button" onClick={handleForgot} disabled={busy}>
              Forgot password?
            </button>
            {passkeys && (
              <Button variant="secondary" size="lg" block loading={busy} onClick={handlePasskey}
                icon={<Fingerprint size={20} strokeWidth={2} aria-hidden="true" />}>
                Sign in with Face ID or fingerprint
              </Button>
            )}
          </form>
        ) : (
          <div className="stack">
            <Button size="lg" block loading={busy || passkeys === null} onClick={handlePasskey} hint={FACE_ID_HINT}
              icon={<Fingerprint size={20} strokeWidth={2} aria-hidden="true" />}>
              Sign in with Face ID or fingerprint
            </Button>
            <Button variant="secondary" size="lg" block onClick={() => setUsePassword(true)}
              icon={<Mail size={20} strokeWidth={2} aria-hidden="true" />}>
              Use a password instead
            </Button>
          </div>
        )}
      </Card>
      <div className="auth-switch">
        <Button to="/signup" variant="secondary" block>Create an account</Button>
      </div>
    </div>
  );
}
