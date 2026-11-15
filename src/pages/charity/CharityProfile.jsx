import { useState } from 'react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { Button, useToast } from '../../components/ui/index.js';
import SignOutButton from '../../components/SignOutButton.jsx';
import { CharityGate, ErrorNote, PlacePicker, VerifiedBadge, VerifyButton } from './components.jsx';
import { REGISTER_LABELS, detectRegister, normaliseCharityNumber } from './shared.js';

function Profile() {
  const { user, charity, refreshProfile } = useAuth();
  const toast = useToast();
  const [orgName, setOrgName] = useState(charity.org_name);
  const [number, setNumber] = useState(charity.charity_number);
  const [email, setEmail] = useState(user.email ?? '');
  const [loc, setLoc] = useState({ address: charity.address ?? '', lat: charity.lat, lng: charity.lng });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const verified = Boolean(charity.verified_at);

  const normalised = normaliseCharityNumber(number);
  const register = detectRegister(normalised);
  const numberChanged = normalised !== charity.charity_number;

  const emailChanged = email.trim().toLowerCase() !== (user.email ?? '').toLowerCase();

  const dirty = orgName.trim() !== charity.org_name || numberChanged || emailChanged
    || loc.address.trim() !== (charity.address ?? '')
    || loc.lat !== charity.lat || loc.lng !== charity.lng;

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!orgName.trim()) { setError('Enter your organisation name.'); return; }
    if (!register) { setError('Charity number format not recognised (e.g. SC012345, 1234567 or NIC100002).'); return; }
    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    const { error: err } = await supabase.from('charities')
      .update({ org_name: orgName.trim(), address: loc.address.trim() || null, lat: loc.lat, lng: loc.lng })
      .eq('profile_id', user.id);
    let checked = null;
    let numErr = null;
    if (!err && numberChanged) {
      const res = await supabase.rpc('update_charity_number', { p_number: normalised });
      numErr = res.error;
      checked = res.data;
    }
    let mailErr = null;
    if (!err && !numErr && emailChanged) {
      const res = await supabase.auth.updateUser(
        { email: email.trim() },
        { emailRedirectTo: `${window.location.origin}/charity/profile` },
      );
      mailErr = res.error;
      if (!mailErr) setEmail(user.email ?? '');
    }
    await refreshProfile();
    if (err || numErr || mailErr) setError(err ?? numErr ?? mailErr);
    else if (emailChanged) toast('Saved. Open the confirmation link we emailed you to switch your email.', 'info');
    else if (numberChanged && !checked) toast('Saved. This number is not in the register yet.', 'warning');
    else toast(checked ? 'Saved. Your charity is verified.' : 'Saved.', 'success');
    setBusy(false);
  };

  return (
    <section className="ch-page">
      <h1>Profile</h1>

      <div className="ch-card ch-details">
        <dl>
          <dt>Status</dt>
          <dd>
            <div className="ch-row">
              <VerifiedBadge verified={verified} />
              {!verified && <VerifyButton variant="secondary" />}
            </div>
          </dd>
        </dl>
      </div>

      <form className="ch-form ch-card" onSubmit={save} noValidate>
        <label className="ch-field">
          <span>Organisation name</span>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} autoComplete="organization" />
        </label>
        <label className="ch-field">
          <span>Charity number</span>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="SC012345"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <small className={register ? 'ch-muted' : 'ch-error'}>
            {register ? REGISTER_LABELS[register] : 'We don’t recognise this number yet'}
          </small>
        </label>
        {numberChanged && verified && register && (
          <p className="ch-muted" role="note">A new number is checked again before you can post.</p>
        )}
        <label className="ch-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
          />
          {user.new_email && (
            <small className="ch-muted">Waiting for you to confirm {user.new_email}</small>
          )}
        </label>
        <PlacePicker value={loc} onChange={setLoc} idPrefix="profile" />
        <ErrorNote error={error} />
        <Button
          type="submit"
          block
          loading={busy}
          disabled={!dirty}
          hint={dirty ? 'Keep these changes.' : 'Change something first.'}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </form>

      <div className="ch-signout">
        <SignOutButton />
      </div>
    </section>
  );
}

export default function CharityProfile() {
  return <CharityGate><Profile /></CharityGate>;
}
