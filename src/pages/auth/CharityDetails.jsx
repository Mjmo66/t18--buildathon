import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { Alert, Badge, Button, Card, Field } from '../../components/ui/index.js';
import AddressField from '../../components/AddressField.jsx';
import { ABOUT_MAX, normaliseWebsite } from '../../lib/website.js';
import { matchesRegistry, normaliseCharityNumber, registerFor, REGISTER_NAMES } from '../../components/charityNumber.js';
import { errorMessage } from './usePasskeySupport.js';

export default function CharityDetails() {
  const { user, profile, charity, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState(profile?.display_name ?? '');
  const [number, setNumber] = useState('');
  const [loc, setLoc] = useState({ address: '', lat: null, lng: null });
  const [about, setAbout] = useState('');
  const [website, setWebsite] = useState('');
  const [websiteError, setWebsiteError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // null | 'verified' | 'unverified'
  const [lookup, setLookup] = useState({ number: '', entry: undefined }); // entry: undefined = checking, null = not found

  const normalised = normaliseCharityNumber(number);
  const register = registerFor(normalised);
  const numberError = number && !register ? 'Use SC + 6 digits (Scotland), 6–7 digits (England & Wales) or NIC + 6 digits (Northern Ireland).' : '';
  const entry = register === 'OSCR' && lookup.number === normalised ? lookup.entry : undefined;
  const nameMismatch = entry && orgName.trim() && !matchesRegistry(orgName, entry);
  const submitBlocker = !register
    ? 'Fill in a valid charity number first'
    : !orgName.trim()
      ? 'Fill in your organisation name first'
      : loc.lat == null
        ? 'Choose your address from the list first'
        : '';

  // Scottish numbers: look the charity up in the register as soon as the number is complete.
  useEffect(() => {
    if (register !== 'OSCR') return undefined;
    let stale = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.from('charity_registry')
        .select('charity_number, org_name, known_as, status, website, activities')
        .eq('charity_number', normalised).maybeSingle();
      if (stale) return;
      setLookup({ number: normalised, entry: data ?? null });
      if (data) {
        // Fill in what the register knows; keep anything the charity already typed.
        setOrgName((cur) => (matchesRegistry(cur, data) ? cur : data.known_as || data.org_name));
        setWebsite((cur) => cur || data.website || '');
        setAbout((cur) => cur || data.activities || '');
      }
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [normalised, register]);

  // Already registered (e.g. returning user) and not in the middle of this form → into the space.
  if (charity && !result) return <Navigate to="/charity" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!register || loc.lat == null || !user) return;
    let site;
    try { site = normaliseWebsite(website); setWebsiteError(''); } catch (e3) { setWebsiteError(e3.message); return; }
    setError('');
    setBusy(true);
    try {
      const { error: insErr } = await supabase.from('charities').insert({
        profile_id: user.id,
        org_name: orgName.trim(),
        charity_number: normalised,
        register,
        address: loc.address.trim() || null,
        lat: loc.lat,
        lng: loc.lng,
        description: about.trim() || null,
        website: site,
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
            <Alert tone="success" title="Your charity is checked">
              {normalised} · {REGISTER_NAMES[register ?? 'OSCR']}
            </Alert>
          ) : (
            <Alert tone="warning" title={
              register !== 'OSCR' ? 'We can only check Scottish charities for now'
                : entry ? 'The name does not match the register' : 'We couldn\'t find this number in the register'
            }>
              You can look around, but you can ask for volunteers only once we have checked your charity.
            </Alert>
          )}
          <Button size="lg" block onClick={() => navigate('/charity', { replace: true })}>Continue</Button>
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
          {register === 'OSCR' && entry && (
            <Alert tone="success" title="Found on the Scottish Charity Register">{entry.org_name}</Alert>
          )}
          {register === 'OSCR' && entry === null && (
            <Alert tone="warning">{normalised} is not on the Scottish Charity Register.</Alert>
          )}
          {register && register !== 'OSCR' && (
            <Alert tone="info">{REGISTER_NAMES[register]}: we can only check Scottish charities for now.</Alert>
          )}
          <Field
            label="Organisation name"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            error={nameMismatch ? `The register lists this charity as “${entry.org_name}”.` : ''}
          />
          {nameMismatch && (
            <div className="row-wrap">
              <Button variant="secondary" onClick={() => setOrgName(entry.org_name)}>Use the registered name</Button>
            </div>
          )}
          <AddressField value={loc} onChange={setLoc} required />
          <Field
            as="textarea"
            label="What your charity does"
            maxLength={ABOUT_MAX}
            placeholder="Your purpose, who you help and what volunteers do with you"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            hint={about.length > ABOUT_MAX - 100 ? `${ABOUT_MAX - about.length} characters left` : undefined}
          />
          <Field
            label="Website"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            placeholder="example.org"
            value={website}
            onChange={(e) => { setWebsite(e.target.value); setWebsiteError(''); }}
            error={websiteError}
          />
          <Button
            type="submit"
            size="lg"
            block
            loading={busy}
            disabled={Boolean(submitBlocker)}
            hint={submitBlocker || undefined}
          >
            Check and continue
          </Button>
        </form>
      </Card>
    </div>
  );
}
