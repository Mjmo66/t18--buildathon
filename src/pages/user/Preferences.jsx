import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import {
  CATEGORIES, EXPERIENCE_LEVELS, PHYSICAL_LEVELS, SLOTS, TRANSPORTS, WEEKDAYS, WEEKDAY_LABELS,
  haversineKm, isAvailabilityEmpty,
} from '../../features/matching/index.js';
import { PLACES } from '../../features/matching/places.js';
import { Alert, Button, Chip, Field, useToast } from '../../components/ui/index.js';
import { milesToKm } from '../../components/format.js';
import { usePrefs, setSkippedPrefs } from './data.js';
import { Check, CircleCheck, LocateFixed } from 'lucide-react';
import { LABELS, Loading, capital } from './ui.jsx';

const SLOT_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
const ANY_DISTANCE_KM = 50;
/** Distance choices in miles; stored as km in max_km. */
const DISTANCES = [
  { label: 'Up to 1 mile', km: milesToKm(1) },
  { label: '2 miles', km: milesToKm(2) },
  { label: '5 miles', km: milesToKm(5) },
  { label: 'Any distance', km: ANY_DISTANCE_KM },
];
const SAVE_HINT = 'Keep these choices. Your list of shifts updates straight away.';

const DEFAULT_FORM = {
  lat: null, lng: null, transport: 'walk', max_km: milesToKm(1),
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
function Options({ value, options, labels, onChange, stack = false, label }) {
  return (
    <div className={`v-options${stack ? ' v-options-stack' : ''}`} role="group" aria-label={label}>
      {options.map((o) => {
        const on = Array.isArray(value) ? value.includes(o) : value === o;
        return (
          <Chip key={o} selected={on} onClick={() => onChange(o)}>
            {on && <Check size={20} strokeWidth={2.5} aria-hidden="true" />}
            {labels?.[o] ?? capital(o)}
          </Chip>
        );
      })}
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <section className="v-card v-step" aria-labelledby={`v-step-${n}`}>
      <h2 className="v-step-title" id={`v-step-${n}`}>
        <span className="v-step-num" aria-hidden="true">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** "Any time" toggle (on by default); when off, one row per day with Morning / Afternoon / Evening. */
export function AvailabilityPicker({ value, onChange, anyTime, setAnyTime }) {
  const has = (d, s) => (value[d] ?? []).includes(s);
  const toggle = (d, s) => {
    const cur = value[d] ?? [];
    const next = { ...value, [d]: has(d, s) ? cur.filter((x) => x !== s) : [...cur, s] };
    const clean = {};
    for (const day of WEEKDAYS) if (next[day]?.length) clean[day] = SLOTS.filter((x) => next[day].includes(x));
    onChange(clean);
  };
  const setAny = (on) => {
    setAnyTime(on);
    if (on) onChange({});
  };

  return (
    <>
      <Chip selected={anyTime} className="v-big-toggle" onClick={() => setAny(!anyTime)}>
        {anyTime && <Check size={22} strokeWidth={2.5} aria-hidden="true" />}
        Any time
      </Chip>
      {!anyTime && (
        <ul className="v-days">
          {WEEKDAYS.map((d) => (
            <li key={d}>
              <span className="v-day-name" id={`v-day-${d}`}>{WEEKDAY_LABELS[d]}</span>
              <div className="v-slots" role="group" aria-labelledby={`v-day-${d}`}>
                {SLOTS.map((s) => (
                  <Chip key={s} selected={has(d, s)} onClick={() => toggle(d, s)}>
                    {has(d, s) && <Check size={18} strokeWidth={2.5} aria-hidden="true" />}
                    {SLOT_LABEL[s]}
                  </Chip>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
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
  const [anyTime, setAnyTime] = useState(true);

  useEffect(() => {
    if (prefs) {
      setForm({
        lat: prefs.lat, lng: prefs.lng, transport: prefs.transport, max_km: Number(prefs.max_km),
        availability: prefs.availability ?? {}, physical_max: prefs.physical_max,
        experience: prefs.experience, interests: prefs.interests ?? [],
      });
      setAnyTime(isAvailabilityEmpty(prefs.availability));
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
      profile_id: user.id, ...form, max_km: Number(form.max_km),
    });
    setSaving(false);
    if (err) { setError(`Could not save: ${err.message}`); return; }
    toast('Saved. Your shifts list is updated.', 'success');
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
  const distanceKey = DISTANCES.find((o) => Math.abs(o.km - Number(form.max_km)) < 0.05)?.label;
  const distanceLabels = Object.fromEntries(DISTANCES.map((o) => [o.label, o.label]));

  return (
    <form className="v-page" onSubmit={save}>
      <h1>{welcome ? 'Find shifts that suit you' : 'Shifts I’m shown'}</h1>

      <Step n={1} title="Where are you?">
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
      </Step>

      <Step n={2} title="How far can you travel?">
        <p className="v-question">How will you get there?</p>
        <Options label="How will you get there?" value={form.transport} options={TRANSPORTS} labels={LABELS.transport}
          onChange={(transport) => update({ transport })} />
        <p className="v-question">How far?</p>
        <Options label="How far?" value={distanceKey} options={DISTANCES.map((o) => o.label)} labels={distanceLabels}
          onChange={(label) => update({ max_km: DISTANCES.find((o) => o.label === label).km })} />
      </Step>

      <Step n={3} title="When are you free?">
        <AvailabilityPicker value={form.availability} anyTime={anyTime} setAnyTime={setAnyTime}
          onChange={(availability) => update({ availability })} />
      </Step>

      <Step n={4} title="Anything else? (optional)">
        <p className="v-question">How much physical work?</p>
        <Options stack label="How much physical work?" value={form.physical_max} options={PHYSICAL_LEVELS}
          labels={LABELS.physicalShort} onChange={(physical_max) => update({ physical_max })} />
        <p className="v-question">Your experience</p>
        <Options stack label="Your experience" value={form.experience} options={EXPERIENCE_LEVELS}
          labels={LABELS.experienceMine} onChange={(experience) => update({ experience })} />
        <p className="v-question">What do you like?</p>
        <Options label="What do you like?" value={form.interests} options={CATEGORIES} labels={LABELS.category}
          onChange={(c) => update({ interests: form.interests.includes(c) ? form.interests.filter((x) => x !== c) : [...form.interests, c] })} />
      </Step>

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
