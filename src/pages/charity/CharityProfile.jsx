import { useState } from 'react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { CharityGate, ErrorNote, PlacePicker, VerifiedBadge, VerifyButton } from './components.jsx';
import { REGISTER_LABELS, fmtDate } from './shared.js';
import { ABOUT_MAX, normaliseWebsite } from '../../lib/website.js';

function Profile() {
  const { user, charity, refreshProfile } = useAuth();
  const [orgName, setOrgName] = useState(charity.org_name);
  const [loc, setLoc] = useState({ address: charity.address ?? '', lat: charity.lat, lng: charity.lng });
  const [about, setAbout] = useState(charity.description ?? '');
  const [website, setWebsite] = useState(charity.website ?? '');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const verified = Boolean(charity.verified_at);

  const dirty = orgName.trim() !== charity.org_name
    || loc.address.trim() !== (charity.address ?? '')
    || loc.lat !== charity.lat || loc.lng !== charity.lng
    || about.trim() !== (charity.description ?? '')
    || website.trim() !== (charity.website ?? '');

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!orgName.trim()) { setError('Enter your organisation name.'); return; }
    let site;
    try { site = normaliseWebsite(website); } catch (e2) { setError(e2); return; }
    setBusy(true);
    const { error: err } = await supabase.from('charities')
      .update({
        org_name: orgName.trim(), address: loc.address.trim() || null, lat: loc.lat, lng: loc.lng,
        description: about.trim() || null, website: site,
      })
      .eq('profile_id', user.id);
    if (err) setError(err);
    else { if (site) setWebsite(site); await refreshProfile(); setSaved(true); }
    setBusy(false);
  };

  return (
    <section className="ch-page">
      <h1>Charity profile</h1>

      <div className="ch-card ch-details">
        <dl>
          <dt>Charity number</dt><dd><code>{charity.charity_number}</code></dd>
          <dt>Register</dt><dd>{REGISTER_LABELS[charity.register] ?? charity.register}</dd>
          <dt>Status</dt>
          <dd>
            <div className="ch-row">
              <VerifiedBadge verified={verified} />
              {verified
                ? <span className="ch-muted ch-small">since {fmtDate(new Date(charity.verified_at))}</span>
                : <VerifyButton className="ch-btn-secondary" />}
            </div>
          </dd>
          <dt>Account</dt><dd>{user.email ?? '—'}</dd>
        </dl>
      </div>

      <form className="ch-form ch-card" onSubmit={save} noValidate>
        <label className="ch-field">
          <span>Organisation name</span>
          <input value={orgName} onChange={(e) => { setOrgName(e.target.value); setSaved(false); }} autoComplete="organization" />
        </label>
        <PlacePicker value={loc} onChange={(v) => { setLoc(v); setSaved(false); }} />
        <label className="ch-field">
          <span>What your charity does</span>
          <textarea
            rows={5}
            maxLength={ABOUT_MAX}
            value={about}
            onChange={(e) => { setAbout(e.target.value); setSaved(false); }}
            placeholder="Your purpose, who you help and what volunteers do with you"
          />
        </label>
        <label className="ch-field">
          <span>Website</span>
          <input
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            placeholder="example.org"
            value={website}
            onChange={(e) => { setWebsite(e.target.value); setSaved(false); }}
          />
        </label>
        <ErrorNote error={error} />
        {saved && <p className="ch-ok" role="status">Saved.</p>}
        <button className="button ch-btn-block" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </section>
  );
}

export default function CharityProfile() {
  return <CharityGate><Profile /></CharityGate>;
}
