import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { Alert, Badge, Button, Card, Chip, Field } from '../../components/ui/index.js';
import { PLACES, placeAddress, getCurrentPosition } from '../../components/places.js';
import { normaliseCharityNumber, registerFor, REGISTER_NAMES } from '../../components/charityNumber.js';
import { errorMessage } from './usePasskeySupport.js';

export default function CharityDetails() {
  const { user, profile, charity, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState(profile?.display_name ?? '');
  const [number, setNumber] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null); // {lat, lng}
  const [placeId, setPlaceId] = useState('');
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // null | 'verified' | 'unverified'

  const normalised = normaliseCharityNumber(number);
  const register = registerFor(normalised);
  const numberError = number && !register ? 'Use SC + 6 digits (Scotland), 6–7 digits (England & Wales) or NIC + 6 digits (Northern Ireland).' : '';

  // Already registered (e.g. returning user) and not in the middle of this form → into the space.
  if (charity && !result) return <Navigate to="/charity" replace />;

  async function useMyLocation() {
    setLocError('');
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setCoords(pos);
      setPlaceId('');
      if (!address) setAddress('St Andrews');
    } catch (e) {
      setLocError(errorMessage(e));
    } finally {
      setLocating(false);
    }
  }

  function pickPlace(id) {
    const place = PLACES.find((p) => p.id === id);
    setPlaceId(id);
    if (!place) return;
    setCoords({ lat: place.lat, lng: place.lng });
    setAddress(placeAddress(place));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!register || !coords || !user) return;
    setError('');
    setBusy(true);
    try {
      const { error: insErr } = await supabase.from('charities').insert({
        profile_id: user.id,
        org_name: orgName.trim(),
        charity_number: normalised,
        register,
        address: address.trim() || null,
        lat: coords.lat,
        lng: coords.lng,
      });
      if (insErr) {
        if (insErr.code === '23505') throw new Error('This charity number is already registered with Kindred.');
        throw insErr;
      }
      const { data: ok, error: rpcErr } = await supabase.rpc('verify_charity');
      if (rpcErr) throw rpcErr;
      setResult(ok ? 'verified' : 'unverified');
      await refreshProfile();
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="auth-page">
        <h1>{orgName}</h1>
        <Card className="stack">
          {result === 'verified' ? (
            <Alert tone="success" title="Verified charity">
              {normalised} · {REGISTER_NAMES[register ?? 'OSCR']}
            </Alert>
          ) : (
            <Alert tone="warning" title="We couldn't find this number in the register">
              You can look around, but you can post requests only once your charity is verified.
            </Alert>
          )}
          <Button block onClick={() => navigate('/charity', { replace: true })}>Continue</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Your charity</h1>
      <Card>
        <form className="stack" onSubmit={handleSubmit}>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Organisation name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <Field
            label="Charity number"
            required
            placeholder="SC012345"
            autoCapitalize="characters"
            autoComplete="off"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            error={numberError}
          />
          {register && <Badge tone="info">{REGISTER_NAMES[register]}</Badge>}
          <Field label="Address" autoComplete="street-address" value={address}
            onChange={(e) => setAddress(e.target.value)} placeholder="Street, St Andrews" />
          <div className="field">
            <span className="field-label">Location</span>
            <div className="row-wrap">
              <Button variant="secondary" size="sm" loading={locating} onClick={useMyLocation}>
                📍 Use my location
              </Button>
              {coords && !placeId && <Badge tone="success">Location set</Badge>}
            </div>
            <div className="chip-row">
              {PLACES.map((p) => (
                <Chip key={p.id} selected={placeId === p.id} onClick={() => pickPlace(p.id)}>{p.name}</Chip>
              ))}
            </div>
            {locError && <p className="field-error">{locError}</p>}
          </div>
          <Button type="submit" block loading={busy} disabled={!register || !coords || !orgName.trim()}>
            Verify and continue
          </Button>
        </form>
      </Card>
    </div>
  );
}
