import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import {
  CATEGORIES, EXPERIENCE_LEVELS, PHYSICAL_LEVELS, TIME_GROUPS, TRANSPORTS, TRANSPORT_DEFAULT_KM,
  availabilityFromGroups, groupsFromAvailability, haversineKm,
} from '../../features/matching/index.js';
import { PLACES } from '../../features/matching/places.js';
import { Alert, Button, Chip, Field, useToast } from '../../components/ui/index.js';
import { usePrefs, setSkippedPrefs } from './data.js';
import { Bike, Bus, Car, Check, ChevronDown, CircleCheck, Footprints, LocateFixed } from 'lucide-react';
import { LABELS, Loading, capital } from './ui.jsx';

const TIME_LABELS = {
  weekdayMornings: 'Weekday mornings', weekdayAfternoons: 'Weekday afternoons', evenings: 'Evenings', weekends: 'Weekends',
};
const TRANSPORT_ICONS = { walk: Footprints, bike: Bike, bus: Bus, car: Car };
const SAVE_HINT = 'Keep these choices. Your list of shifts updates straight away.';

const DEFAULT_FORM = {
  lat: null, lng: null, transport: 'walk', max_km: TRANSPORT_DEFAULT_KM.walk,
  availability: {}, physical_max: 'moderate', experience: 'none', interests: [],
};

function nearestPlace(lat, lng) {
  if (lat == null || lng == null) return null;
  let best = null;
  for (const p of PLACES) {
    const d = haversineKm({ lat, lng }, p);
    if (!best || d < best.d) best = { name: p.name, d };
  }
  return best;
}

/** A row of big toggle buttons with text; the chosen one is filled and ticked. */
function Options({ value, options, labels, icons, onChange, stack = false, label }) {
  return (
    <div className={`v-options${stack ? ' v-options-stack' : ''}`} role="group" aria-label={label}>
      {options.map((o) => {
        const on = Array.isArray(value) ? value.includes(o) : value === o;
        const I = icons?.[o];
        return (
          <Chip key={o} selected={on} onClick={() => onChange(o)}>
            {on ? <Check size={20} strokeWidth={2.5} aria-hidden="true" /> : I && <I size={20} aria-hidden="true" />}
            {labels?.[o] ?? capital(o)}
          </Chip>
        );
      })}
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section className="v-card v-step" aria-labelledby={id}>
      <h2 className="v-step-title" id={id}>{title}</h2>
      {children}
    </section>
  );
}

/** Five big toggles. "Any time" (no group, stored as {}) switches the other four off; any other one switches it off. */
function TimeToggles({ groups, onChange }) {
  const toggle = (g) => onChange(groups.includes(g) ? groups.filter((x) => x !== g) : [...groups, g]);
  const anyTime = groups.length === 0;
  const item = (key, label, on, onClick) => (
    <Chip key={key} selected={on} onClick={onClick}>
      {on && <Check size={20} strokeWidth={2.5} aria-hidden="true" />}
      {label}
    </Chip>
  );
  return (
    <div className="v-options v-options-stack" role="group" aria-label="When are you free?">
      {Object.keys(TIME_GROUPS).map((g) => item(g, TIME_LABELS[g], groups.includes(g), () => toggle(g)))}
      {item('any', 'Any time', anyTime, () => onChange([]))}
    </div>
  );
}

export default function Preferences() {
  const { user, loading: authLoading } = useAuth();
  const { prefs, loading } = usePrefs(user?.id);
  const [params] = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locSource, setLocSource] = useState(null); // 'gps' | place name
  const [groups, setGroups] = useState([]); // TIME_GROUPS keys that are on; [] = any time
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (prefs) {
      setForm({
        lat: prefs.lat, lng: prefs.lng, transport: prefs.transport, max_km: Number(prefs.max_km),
        availability: prefs.availability ?? {}, physical_max: prefs.physical_max,
        experience: prefs.experience, interests: prefs.interests ?? [],
      });
      setGroups(groupsFromAvailability(prefs.availability ?? {}));
    }
  }, [prefs]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const near = useMemo(() => nearestPlace(form.lat, form.lng), [form.lat, form.lng]);
  const placeValue = near && near.d < 0.05 && locSource !== 'gps' ? near.name : '';

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError("Your browser can't share your location. Choose your area instead."); return; }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocSource('gps');
        update({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        setError(err.code === 1 ? 'Kindred was not allowed to see your location. Choose your area instead.' : 'Could not find your location. Choose your area instead.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const pickPlace = (name) => {
    const p = PLACES.find((x) => x.name === name);
    if (!p) return;
    setLocSource(name);
    update({ lat: p.lat, lng: p.lng });
  };

  const save = async (e) => {
    e?.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('volunteer_prefs').upsert({
      profile_id: user.id, ...form, availability: availabilityFromGroups(groups), max_km: Number(form.max_km),
    });
    setSaving(false);
    if (err) { setError(`Could not save: ${err.message}`); return; }
    toast('Saved.', 'success');
    navigate('/user', { replace: welcome });
  };

  const skip = () => { setSkippedPrefs(); navigate('/user', { replace: true }); };

  if (authLoading || loading) return <div className="v-page"><Loading /></div>;
  if (!user) return <div className="v-page"><p className="v-muted">Sign in to choose what you're shown.</p></div>;

  let locLabel = null;
  if (form.lat != null) {
    locLabel = locSource === 'gps' ? 'Your current location'
      : near && near.d < 0.05 ? near.name
      : near ? `Near ${near.name}` : 'Your chosen place';
  }

  return (
    <form className="v-page" onSubmit={save}>
      <h1>{welcome ? 'Find shifts that suit you' : 'Shifts I’m shown'}</h1>

      <Section id="v-where" title="Where are you?">
        {locLabel && (
          <p className="v-status"><CircleCheck size={22} strokeWidth={2} aria-hidden="true" />{locLabel}</p>
        )}
        <Button variant="secondary" block onClick={useMyLocation} loading={locating}
          icon={<LocateFixed size={20} aria-hidden="true" />} hint="Let Kindred find shifts near where you are now.">
          {locating ? 'Finding you…' : 'Use my location'}
        </Button>
        <Field as="select" label="Or choose your area" value={placeValue} onChange={(e) => pickPlace(e.target.value)}>
          <option value="">Choose an area</option>
          {PLACES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </Field>
      </Section>

      <Section id="v-travel" title="How will you get there?">
        <Options label="How will you get there?" value={form.transport} options={TRANSPORTS} labels={LABELS.transport}
          icons={TRANSPORT_ICONS} onChange={(transport) => update({ transport, max_km: TRANSPORT_DEFAULT_KM[transport] })} />
      </Section>

      <Section id="v-when" title="When are you free?">
        <TimeToggles groups={groups} onChange={setGroups} />
      </Section>

      {!more ? (
        <Button variant="secondary" block onClick={() => setMore(true)} aria-expanded={false}
          icon={<ChevronDown size={20} aria-hidden="true" />}>
          More choices (optional)
        </Button>
      ) : (
        <Section id="v-more" title="More choices">
          <p className="v-question">How much physical work?</p>
          <Options stack label="How much physical work?" value={form.physical_max} options={PHYSICAL_LEVELS}
            labels={LABELS.physicalShort} onChange={(physical_max) => update({ physical_max })} />
          <p className="v-question">Your experience</p>
          <Options stack label="Your experience" value={form.experience} options={EXPERIENCE_LEVELS}
            labels={LABELS.experienceMine} onChange={(experience) => update({ experience })} />
          <p className="v-question">What do you like?</p>
          <Options label="What do you like?" value={form.interests} options={CATEGORIES} labels={LABELS.category}
            onChange={(c) => update({ interests: form.interests.includes(c) ? form.interests.filter((x) => x !== c) : [...form.interests, c] })} />
        </Section>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      {welcome && (
        <Button variant="secondary" block onClick={skip} hint="See all shifts now. You can choose later in My profile.">
          Skip for now
        </Button>
      )}

      <div className="v-action-bar v-save-bar">
        <Button type="submit" size="lg" block loading={saving} hint={SAVE_HINT}>
          {saving ? 'Saving…' : 'Save my choices'}
        </Button>
      </div>
    </form>
  );
}
