import { useState } from 'react';
import { Building2, Fingerprint, HandHeart } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { signUpWithPasskey } from '../../lib/auth/passkey';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { Alert, Button, Card, Chip, Field } from '../../components/ui/index.js';
import { usePasskeySupport, errorMessage } from './usePasskeySupport.js';
import PasswordField from './PasswordField.jsx';

const ROLES = ['volunteer', 'charity'];

export default function Signup() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const passkeys = usePasskeySupport();
  const queryRole = ROLES.includes(params.get('role') ?? '') ? params.get('role') : null;
  const [role, setRole] = useState(queryRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);
  const showPassword = usePassword || passkeys === false;
  const isCharity = role === 'charity';

  function pickRole(r) {
    setRole(r);
    setParams({ role: r }, { replace: true });
  }

  async function done() {
    await refreshProfile();
    navigate(isCharity ? '/charity-details' : '/user', { replace: true });
  }

  async function run(fn) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function handlePasskey(e) {
    e.preventDefault();
    if (!role) return;
    run(async () => {
      await signUpWithPasskey({ email: email.trim(), displayName: name.trim(), role });
      await done();
    });
  }

  function handlePassword(e) {
    e.preventDefault();
    if (!role) return;
    run(async () => {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { role, display_name: name.trim() } },
      });
      if (err) throw err;
      // With "Confirm email" switched on, Supabase returns no session until the link is clicked.
      if (!data.session) {
        setCheckEmail(true);
        return;
      }
      await done();
    });
  }

  if (checkEmail) {
    return (
      <div className="auth-page">
        <h1>Check your email</h1>
        <Card>
          <Alert tone="info">We sent a confirmation link to {email}.</Alert>
          <Button to="/login" variant="secondary" block>Back to sign in</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>{isCharity ? 'Register your charity' : role ? 'Join as a volunteer' : 'Create an account'}</h1>
      <Card>
        <form className="stack" onSubmit={showPassword ? handlePassword : handlePasskey}>
          {!queryRole && (
            <div className="role-picker" role="group" aria-label="I am">
              <Chip selected={role === 'volunteer'} onClick={() => pickRole('volunteer')}><HandHeart size={18} strokeWidth={1.75} aria-hidden="true" /> Volunteer</Chip>
              <Chip selected={role === 'charity'} onClick={() => pickRole('charity')}><Building2 size={18} strokeWidth={1.75} aria-hidden="true" /> Charity</Chip>
            </div>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          <Field
            label={isCharity ? 'Organisation name' : 'Your name'}
            autoComplete={isCharity ? 'organization' : 'name'}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field label="Email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} />
          {showPassword && (
            <PasswordField label="Password" autoComplete="new-password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
          <Button
            type="submit"
            size="lg"
            block
            loading={busy || (!showPassword && passkeys === null)}
            disabled={!role}
            hint={!role ? 'Choose volunteer or charity first' : undefined}
            help={!showPassword ? "Your phone checks it's you. No password to remember." : undefined}
            icon={!showPassword ? <Fingerprint size={20} strokeWidth={2} aria-hidden="true" /> : undefined}
          >
            {showPassword ? 'Create account' : 'Sign up with Face ID or fingerprint'}
          </Button>
          {passkeys && (
            <Button variant="secondary" block onClick={() => setUsePassword((v) => !v)}>
              {showPassword ? 'Use Face ID instead' : 'Use a password instead'}
            </Button>
          )}
        </form>
      </Card>
      <div className="auth-switch">
        <Button to="/login" variant="secondary" block>I already have an account</Button>
        {queryRole && (
          <Button variant="secondary" block onClick={() => pickRole(isCharity ? 'volunteer' : 'charity')}>
            {isCharity ? "I'm volunteering instead" : "I'm signing up a charity"}
          </Button>
        )}
      </div>
    </div>
  );
}
