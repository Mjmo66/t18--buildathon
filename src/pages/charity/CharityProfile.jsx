import { useState } from 'react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { Button, useToast } from '../../components/ui/index.js';
import SignOutButton from '../../components/SignOutButton.jsx';
import { CharityGate, ErrorNote, PlacePicker, VerifiedBadge, VerifyButton } from './components.jsx';
import { REGISTER_LABELS } from './shared.js';

function Profile() {
  const { user, charity, refreshProfile } = useAuth();
  const toast = useToast();
  const [orgName, setOrgName] = useState(charity.org_name);
  const [loc, setLoc] = useState({ address: charity.address ?? '', lat: charity.lat, lng: charity.lng });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const verified = Boolean(charity.verified_at);

  const dirty = orgName.trim() !== charity.org_name
    || loc.address.trim() !== (charity.address ?? '')
    || loc.lat !== charity.lat || loc.lng !== charity.lng;

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!orgName.trim()) { setError('Enter your organisation name.'); return; }
    setBusy(true);
    const { error: err } = await supabase.from('charities')
      .update({ org_name: orgName.trim(), address: loc.address.trim() || null, lat: loc.lat, lng: loc.lng })
      .eq('profile_id', user.id);
    if (err) setError(err);
    else { await refreshProfile(); toast('Saved.', 'success'); }
    setBusy(false);
  };

  return (
    <section className="ch-page">
      <h1>Profile</h1>

      <div className="ch-card ch-details">
        <dl>
          <dt>Charity number</dt><dd>{charity.charity_number}</dd>
          <dt>Register</dt><dd>{REGISTER_LABELS[charity.register] ?? charity.register}</dd>
          <dt>Status</dt>
          <dd>
            <div className="ch-row">
              <VerifiedBadge verified={verified} />
              {!verified && <VerifyButton variant="secondary" />}
            </div>
          </dd>
          <dt>Email</dt><dd>{user.email ?? '—'}</dd>
        </dl>
      </div>

      <form className="ch-form ch-card" onSubmit={save} noValidate>
        <label className="ch-field">
          <span>Organisation name</span>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} autoComplete="organization" />
        </label>
        <PlacePicker value={loc} onChange={setLoc} idPrefix="profile" />
        <ErrorNote error={error} />
        <Button
          type="submit"
          block
          loading={busy}
          disabled={!dirty}
          hint={dirty ? 'Keep these changes.' : 'Change the name or place first.'}
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
