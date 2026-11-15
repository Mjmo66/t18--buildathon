import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { signInWithPasskey } from '../../lib/auth/passkey';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { Alert, Button, Card, Field } from '../../components/ui/index.js';
import { usePasskeySupport, errorMessage } from './usePasskeySupport.js';

export default function Login() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const passkeys = usePasskeySupport();
  const [usePassword, setUsePassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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

  return (
    <div className="auth-page">
      <h1>Sign in</h1>
      <Card>
        {error && <Alert tone="danger">{error}</Alert>}
        {showPassword ? (
          <form className="stack" onSubmit={handlePassword}>
            <Field label="Email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
            <Field label="Password" type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" block loading={busy}>Sign in</Button>
            {passkeys && (
              <button type="button" className="link-button" onClick={() => setUsePassword(false)}>
                Use a passkey instead
              </button>
            )}
          </form>
        ) : (
          <div className="stack">
            <Button block loading={busy || passkeys === null} onClick={handlePasskey}>
              Sign in with passkey
            </Button>
            <button type="button" className="link-button" onClick={() => setUsePassword(true)}>
              Use a password instead
            </button>
          </div>
        )}
      </Card>
      <p className="auth-switch">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  );
}
