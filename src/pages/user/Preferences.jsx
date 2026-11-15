import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import {
  CATEGORIES, EXPERIENCE_LEVELS, PHYSICAL_LEVELS, SLOTS, TRANSPORT_DEFAULT_KM, WEEKDAYS, WEEKDAY_LABELS,
  isAvailabilityEmpty,
} from '../../features/matching/index.js';
import { Alert, Button, Chip, useToast } from '../../components/ui/index.js';
import AddressField from '../../components/AddressField.jsx';
import { reverseGeocode } from '../../lib/address.js';
import { usePrefs, setSkippedPrefs } from './data.js';
import { Car, Check, ChevronDown, Footprints } from 'lucide-react';
import { LABELS, Loading, capital } from './ui.jsx';

/** Times of day, with the hours they cover (matching uses the same hours: SLOT_HOURS). */
const SLOT_TEXT = { morning: ['Morning', '6am–12pm'], afternoon: ['Afternoon', '12pm–5pm'], evening: ['Evening', '5pm–10pm'] };
const CAR_LABELS = { yes: 'Yes, I have a car', no: 'No car' };
const CAR_ICONS = { yes: Car, no: Footprints };
/** How far people will travel, in miles; stored as km. */
const MILE_OPTIONS = [1, 3, 5, 10, 20];
const KM_PER_MILE = 1.609344;
const milesToKm = (mi) => Math.round(mi * KM_PER_MILE * 10) / 10;
const nearestMiles = (km) => MILE_OPTIONS.reduce((best, mi) => (Math.abs(milesToKm(mi) - km) < Math.abs(milesToKm(best) - km) ? mi : best));
/** Default distance when the volunteer says whether they have a car. */
const CAR_DEFAULT_MILES = { yes: 10, no: 3 };
const SAVE_HINT = 'Keep these choices. Your list of shifts updates straight away.';

const DEFAULT_FORM = {
  lat: null, lng: null, transport: 'walk', max_km: TRANSPORT_DEFAULT_KM.walk,
  // availability: {mon: ['morning', ...], ...}; {} means any time
  availability: {}, physical_max: 'moderate', experience: 'none', interests: [],
};

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

/** Stored grid → the days and times to show as chosen (any day with a time; every time on any day). */
function splitAvailability(availability) {
  const days = WEEKDAYS.filter((d) => (availability?.[d] ?? []).length);
  const slots = SLOTS.filter((s) => days.some((d) => availability[d].includes(s)));
  return { days, slots };
}

/** Chosen days × chosen times → stored grid. Days only = all day; times only = every day; neither = any time ({}). */
function joinAvailability(days, slots) {
  if (!days.length && !slots.length) return {};
  const useDays = days.length ? days : WEEKDAYS;
  const useSlots = slots.length ? slots : SLOTS;
  return Object.fromEntries(WEEKDAYS.filter((d) => useDays.includes(d)).map((d) => [d, SLOTS.filter((s) => useSlots.includes(s))]));
}

/** Two short questions: which days, then what times of day. The times apply to every chosen day. */
function FreeTimes({ availability, onChange }) {
  const initial = splitAvailability(availability);
  const [days, setDays] = useState(initial.days);
  const [slots, setSlots] = useState(initial.slots);
  // Saved preferences arrive after the first render: pick them up once.
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (synced || isAvailabilityEmpty(availability)) return;
    const next = splitAvailability(availability);
    setDays(next.days);
    setSlots(next.slots);
    setSynced(true);
  }, [availability, synced]);

  const set = (nextDays, nextSlots) => {
    setDays(nextDays);
    setSlots(nextSlots);
    setSynced(true);
    onChange(joinAvailability(nextDays, nextSlots));
  };
  const flip = (list, item, order) => (list.includes(item) ? list.filter((x) => x !== item) : order.filter((x) => x === item || list.includes(x)));
  const anyTime = !days.length && !slots.length;

  return (
    <div className="v-free">
      <p className="v-question">Which days?</p>
      <div className="v-free-days" role="group" aria-label="Which days are you free?">
        {WEEKDAYS.map((d) => {
          const on = days.includes(d);
          return (
            <Chip key={d} selected={on} onClick={() => set(flip(days, d, WEEKDAYS), slots)} aria-label={WEEKDAY_LABELS[d]}>
              {WEEKDAY_LABELS[d].slice(0, 3)}
            </Chip>
          );
        })}
      </div>

      <p className="v-question">What times of day?</p>
      <div className="v-options v-options-stack" role="group" aria-label="What times of day are you free?">
        {SLOTS.map((slot) => {
          const on = slots.includes(slot);
          return (
            <Chip key={slot} selected={on} onClick={() => set(days, flip(slots, slot, SLOTS))}>
              {on && <Check size={20} strokeWidth={2.5} aria-hidden="true" />}
              <span className="v-slot-line">
                {SLOT_TEXT[slot][0]} <span className="v-slot-hours">{SLOT_TEXT[slot][1]}</span>
              </span>
            </Chip>
          );
        })}
      </div>

      <Chip selected={anyTime} onClick={() => set([], [])}>
        {anyTime && <Check size={20} strokeWidth={2.5} aria-hidden="true" />}
        I’m flexible: any day, any time
      </Chip>
      <p className="v-free-summary" role="status">{summary(days, slots)}</p>
    </div>
  );
}

/** One plain sentence saying what will be saved. */
function summary(days, slots) {
  const dayText = !days.length ? 'Any day' : days.length === 7 ? 'Every day' : days.map((d) => WEEKDAY_LABELS[d].slice(0, 3)).join(', ');
  const timeText = !slots.length || slots.length === 3 ? 'any time' : slots.map((s) => SLOT_TEXT[s][0].toLowerCase()).join(' and ');
  return `${dayText}, ${timeText}.`;
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
  const [address, setAddress] = useState(''); // shown only; volunteer_prefs keeps the point
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (prefs) {
      setForm({
        lat: prefs.lat, lng: prefs.lng, transport: prefs.transport, max_km: Number(prefs.max_km),
        availability: prefs.availability ?? {}, physical_max: prefs.physical_max,
        experience: prefs.experience, interests: prefs.interests ?? [],
      });
    }
  }, [prefs]);

  // A saved point has no stored address: show the nearest one.
  useEffect(() => {
    if (prefs?.lat == null || prefs?.lng == null) return undefined;
    const ctrl = new AbortController();
    reverseGeocode({ lat: prefs.lat, lng: prefs.lng }, { signal: ctrl.signal })
      .then((place) => { if (place?.address) setAddress((a) => a || place.address); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [prefs?.lat, prefs?.lng]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const hasCar = form.transport === 'car';
  // No car keeps someone's earlier walk/bike/bus choice (used for directions); otherwise public transport.
  const setCar = (answer) => update(answer === 'yes'
    ? { transport: 'car', max_km: milesToKm(CAR_DEFAULT_MILES.yes) }
    : { transport: hasCar ? 'bus' : form.transport, max_km: milesToKm(CAR_DEFAULT_MILES.no) });
  const setLocation = (v) => {
    setAddress(v.address);
    if (v.lat !== form.lat || v.lng !== form.lng) update({ lat: v.lat, lng: v.lng });
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
    toast('Saved.', 'success');
    navigate('/user', { replace: welcome });
  };

  const skip = () => { setSkippedPrefs(); navigate('/user', { replace: true }); };

  if (authLoading || loading) return <div className="v-page"><Loading /></div>;
  if (!user) return <div className="v-page"><p className="v-muted">Sign in to choose what you're shown.</p></div>;

  return (
    <form className="v-page" onSubmit={save}>
      <h1>{welcome ? 'Find shifts that suit you' : 'Shifts I’m shown'}</h1>

      <Section id="v-where" title="Where are you?">
        <AddressField label="Address or postcode" value={{ address, lat: form.lat, lng: form.lng }} onChange={setLocation} />
      </Section>

      <Section id="v-car" title="Do you have a car?">
        <Options label="Do you have a car?" value={hasCar ? 'yes' : 'no'} options={['yes', 'no']} labels={CAR_LABELS}
          icons={CAR_ICONS} onChange={setCar} />
      </Section>

      <Section id="v-distance" title="How far will you travel?">
        <Options label="How far will you travel?" value={nearestMiles(Number(form.max_km))} options={MILE_OPTIONS}
          labels={Object.fromEntries(MILE_OPTIONS.map((mi) => [mi, `Up to ${mi} ${mi === 1 ? 'mile' : 'miles'}`]))}
          onChange={(mi) => update({ max_km: milesToKm(mi) })} />
      </Section>

      <Section id="v-when" title="When are you free?">
        <FreeTimes availability={form.availability} onChange={(availability) => update({ availability })} />
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
