// Small building blocks for the charity pages, built on the shared UI kit.
import { useState } from 'react';
import { BadgeCheck, CircleAlert, LocateFixed, MapPin } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/index.js';
import { PLACES, REGISTER_LABELS, detectRegister, normaliseCharityNumber } from './shared.js';
import './charity.css';

export function Loading({ label = 'Loading…' }) {
  return <p className="ch-muted ch-loading" role="status">{label}</p>;
}

export function Empty({ children }) {
  return <div className="ch-empty">{children}</div>;
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <p className="ch-error" role="alert">{String(error.message ?? error)}</p>;
}

export function VerifiedBadge({ verified }) {
  return verified
    ? <span className="ch-badge ch-badge-ok"><BadgeCheck size={18} strokeWidth={2} aria-hidden="true" />Verified charity</span>
    : <span className="ch-badge ch-badge-warn"><CircleAlert size={18} strokeWidth={2} aria-hidden="true" />Not verified yet</span>;
}

// Plain words for request and signup statuses.
export const STATUS_WORDS = {
  open: 'Open',
  filled: 'Enough volunteers',
  closed: 'Cancelled',
  applied: 'Waiting for your reply',
  accepted: 'Confirmed',
  attended: 'Came',
  no_show: 'Did not come',
  declined: 'You said no',
  cancelled: 'Cancelled their place',
};

export function StatusPill({ status }) {
  return <span className={`ch-pill ch-pill-${status}`}>{STATUS_WORDS[status] ?? status}</span>;
}

/** Renders children only for a signed-in charity with a charities row; otherwise the right state. */
export function CharityGate({ children }) {
  const { user, profile, charity, loading } = useAuth();
  if (loading || (user && !profile)) return <Loading />;
  if (!user) {
    return (
      <Empty>
        <p>Sign in with your charity account.</p>
        <Button to="/">Go to sign in</Button>
      </Empty>
    );
  }
  if (profile.role !== 'charity') return <Empty><p>This area is for charity accounts.</p></Empty>;
  if (!charity) return <CharityOnboarding />;
  return children;
}

/** Calls verify_charity() and refreshes the auth context. */
export function VerifyButton({ variant = 'primary' }) {
  const { refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const verify = async () => {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc('verify_charity');
    if (error) setMsg(error.message);
    else if (!data) setMsg('Charity number not found in the register.');
    else await refreshProfile();
    setBusy(false);
  };
  return (
    <span className="ch-verify">
      <Button variant={variant} onClick={verify} loading={busy} hint="Look up your charity number in the official register.">
        {busy ? 'Checking…' : 'Check my charity now'}
      </Button>
      {msg && <span className="ch-error">{msg}</span>}
    </span>
  );
}

/** Place select + "Use my location". value: {address, lat, lng}. */
export function PlacePicker({ value, onChange, idPrefix = 'place' }) {
  const [geoState, setGeoState] = useState(null);
  const selected = PLACES.find((p) => p.lat === value.lat && p.lng === value.lng)?.name ?? '';

  const pick = (name) => {
    const p = PLACES.find((x) => x.name === name);
    if (p) onChange({ address: p.name, lat: p.lat, lng: p.lng });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeoState('Location is not available in this browser.'); return; }
    setGeoState('Locating…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = +pos.coords.latitude.toFixed(5);
        const lng = +pos.coords.longitude.toFixed(5);
        onChange({ address: value.address || `Near ${lat}, ${lng}`, lat, lng });
        setGeoState(null);
      },
      (err) => setGeoState(err.code === 1 ? 'Location permission denied.' : 'Could not get your location.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="ch-place">
      <label className="ch-field">
        <span>Place</span>
        <select id={`${idPrefix}-select`} value={selected} onChange={(e) => pick(e.target.value)}>
          <option value="">Choose a St Andrews place…</option>
          {PLACES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </label>
      <Button
        variant="secondary"
        icon={<LocateFixed size={20} aria-hidden="true" />}
        onClick={useMyLocation}
        hint="Use the place where you are now."
      >
        Use my location
      </Button>
      {geoState && <span className="ch-muted">{geoState}</span>}
      <label className="ch-field">
        <span>Address</span>
        <input
          id={`${idPrefix}-address`}
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="e.g. East Sands, St Andrews KY16"
          autoComplete="street-address"
        />
      </label>
      {value.lat != null && (
        <span className="ch-muted ch-coords"><MapPin size={20} aria-hidden="true" />Place found on the map</span>
      )}
    </div>
  );
}

/** First-time setup for a charity account without a charities row. */
export function CharityOnboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const [orgName, setOrgName] = useState(profile?.display_name ?? '');
  const [number, setNumber] = useState('');
  const [loc, setLoc] = useState({ address: '', lat: null, lng: null });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const normalised = normaliseCharityNumber(number);
  const register = detectRegister(normalised);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!orgName.trim()) return setError('Enter your organisation name.');
    if (!register) return setError('Charity number format not recognised (e.g. SC012345, 1234567 or NIC100002).');
    setBusy(true);
    const { error: insErr } = await supabase.from('charities').insert({
      profile_id: user.id,
      org_name: orgName.trim(),
      charity_number: normalised,
      register,
      address: loc.address.trim() || null,
      lat: loc.lat,
      lng: loc.lng,
    });
    if (insErr) {
      setBusy(false);
      return setError(insErr.code === '23505' ? 'This charity number is already registered.' : insErr.message);
    }
    await supabase.rpc('verify_charity'); // demo registry lookup; result shows as the badge
    await refreshProfile();
    setBusy(false);
  };

  return (
    <section className="ch-page">
      <h1>Set up your charity</h1>
      <form className="ch-form ch-card" onSubmit={submit} noValidate>
        <label className="ch-field">
          <span>Organisation name</span>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} required autoComplete="organization" />
        </label>
        <label className="ch-field">
          <span>Charity number</span>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="SC012345"
            autoCapitalize="characters"
            required
          />
          {normalised && (
            <small className={register ? 'ch-muted' : 'ch-error'}>
              {register ? REGISTER_LABELS[register] : 'We don’t recognise this number yet'}
            </small>
          )}
        </label>
        <PlacePicker value={loc} onChange={setLoc} idPrefix="onb" />
        <ErrorNote error={error} />
        <Button type="submit" size="lg" block loading={busy}>{busy ? 'Saving…' : 'Save and check my charity'}</Button>
      </form>
    </section>
  );
}
