import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import {
  CATEGORIES, EXPERIENCE_LEVELS, PHYSICAL_LEVELS, SLOTS, TRANSPORTS, TRANSPORT_DEFAULT_KM,
  WEEKDAYS, haversineKm, formatKm,
} from '../../features/matching/index.js';
import { PLACES } from '../../features/matching/places.js';
import { usePrefs, setSkippedPrefs } from './data.js';
import { Check, LocateFixed, Moon, Sun, Sunset } from 'lucide-react';
import { LABELS, Loading, capital } from './ui.jsx';

const DAY_SHORT = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const SLOT_SHORT = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
const SLOT_ICON = { morning: Sun, afternoon: Sunset, evening: Moon };
function SlotIcon({ slot, size = 18 }) {
  const I = SLOT_ICON[slot];
  return <I size={size} strokeWidth={1.75} aria-hidden="true" />;
}
const MAX_KM_LIMIT = 50;

const tick = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };

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

function Segmented({ value, options, labels, onChange, wrap = false, multi = false }) {
  const pressed = (o) => (multi ? value.includes(o) : value === o);
  return (
    <div className={`v-seg${wrap ? ' v-seg-wrap' : ''}`}>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={pressed(o)} onClick={() => { tick(); onChange(o); }}>
          {labels?.[o] ?? capital(o)}
        </button>
      ))}
    </div>
  );
}

export function AvailabilityGrid({ value, onChange }) {
  const has = (d, s) => (value[d] ?? []).includes(s);
  const set = (next) => {
    const clean = {};
    for (const d of WEEKDAYS) if (next[d]?.length) clean[d] = SLOTS.filter((s) => next[d].includes(s));
    onChange(clean);
  };
  const toggle = (d, s) => {
    tick();
    const cur = value[d] ?? [];
    set({ ...value, [d]: has(d, s) ? cur.filter((x) => x !== s) : [...cur, s] });
  };
  const toggleDay = (d) => {
    tick();
    const all = SLOTS.every((s) => has(d, s));
    set({ ...value, [d]: all ? [] : [...SLOTS] });
  };
  const toggleSlot = (s) => {
    tick();
    const all = WEEKDAYS.every((d) => has(d, s));
    const next = { ...value };
    for (const d of WEEKDAYS) {
      const cur = next[d] ?? [];
      next[d] = all ? cur.filter((x) => x !== s) : [...new Set([...cur, s])];
    }
    set(next);
  };
  const preset = (days, slots) => {
    tick();
    const next = {};
    for (const d of days) next[d] = slots;
    set(next);
  };

  return (
    <div className="v-field">
      <div className="v-grid" role="group" aria-label="Weekly availability">
        <span />
        {SLOTS.map((s) => (
          <button key={s} type="button" className="v-grid-head" onClick={() => toggleSlot(s)}
            aria-label={`Toggle every ${s}`}>
            <SlotIcon slot={s} size={15} />
            {SLOT_SHORT[s]}
          </button>
        ))}
        {WEEKDAYS.map((d) => (
          <Row key={d} d={d} has={has} toggle={toggle} toggleDay={toggleDay} />
        ))}
      </div>
      <div className="v-row">
        <button type="button" className="v-btn v-btn-secondary v-btn-sm"
          onClick={() => preset(['sat', 'sun'], [...SLOTS])}>Weekends</button>
        <button type="button" className="v-btn v-btn-secondary v-btn-sm"
          onClick={() => preset(['mon', 'tue', 'wed', 'thu', 'fri'], ['evening'])}>Weekday evenings</button>
        <button type="button" className="v-btn v-btn-secondary v-btn-sm" onClick={() => preset([], [])}>Clear</button>
      </div>
      <span className="v-muted v-small">Nothing selected means any time.</span>
    </div>
  );
}

function Row({ d, has, toggle, toggleDay }) {
  return (
    <>
      <button type="button" className="v-grid-day" onClick={() => toggleDay(d)} aria-label={`Toggle all of ${d}`}>
        {DAY_SHORT[d]}
      </button>
      {SLOTS.map((s) => (
        <button key={s} type="button" className="v-cell" aria-pressed={has(d, s)}
          aria-label={`${DAY_SHORT[d]} ${s}`} onClick={() => toggle(d, s)}>
          {has(d, s) ? <SlotIcon slot={s} /> : null}
        </button>
      ))}
    </>
  );
}

export default function Preferences() {
  const { user, loading: authLoading } = useAuth();
  const { prefs, loading } = usePrefs(user?.id);
  const [params] = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const navigate = useNavigate();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locSource, setLocSource] = useState(null); // 'gps' | place name

  useEffect(() => {
    if (prefs) {
      setForm({
        lat: prefs.lat, lng: prefs.lng, transport: prefs.transport, max_km: Number(prefs.max_km),
        availability: prefs.availability ?? {}, physical_max: prefs.physical_max,
        experience: prefs.experience, interests: prefs.interests ?? [],
      });
    }
  }, [prefs]);

  const update = (patch) => { setSaved(false); setForm((f) => ({ ...f, ...patch })); };
  const near = useMemo(() => nearestPlace(form.lat, form.lng), [form.lat, form.lng]);
  const placeValue = near && near.d < 0.05 && locSource !== 'gps' ? near.name : '';

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('Location is not available in this browser'); return; }
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
        setError(err.code === 1 ? 'Location permission denied. Pick a place instead.' : 'Could not get your location. Pick a place instead.');
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
    setSaved(true);
    if (welcome) navigate('/user', { replace: true });
  };

  const skip = () => { setSkippedPrefs(); navigate('/user', { replace: true }); };

  if (authLoading || loading) return <div className="v-page"><Loading /></div>;
  if (!user) return <div className="v-page"><p className="v-muted">Sign in to set your preferences.</p></div>;

  let locLabel = 'Not set';
  if (form.lat != null) {
    locLabel = locSource === 'gps' ? 'Your current location'
      : near && near.d < 0.05 ? near.name
      : near ? `Near ${near.name}` : 'Custom location';
  }

  return (
    <form className="v-page" onSubmit={save}>
      <div className="v-between">
        <h1>{welcome ? 'Your preferences' : 'Preferences'}</h1>
        {welcome && <button type="button" className="v-btn v-btn-secondary v-btn-sm" onClick={skip}>Skip</button>}
      </div>

      <section className="v-card">
        <h2>Location</h2>
        <div className="v-between">
          <span>{locLabel}</span>
          {form.lat != null && <span className="v-chip" aria-label="Location set"><Check size={14} strokeWidth={2.25} aria-hidden="true" /></span>}
        </div>
        <button type="button" className="v-btn v-btn-secondary" onClick={useMyLocation} disabled={locating}>
          <LocateFixed size={18} strokeWidth={1.75} aria-hidden="true" />
          {locating ? 'Locating…' : 'Use my location'}
        </button>
        <select className="v-select" value={placeValue} onChange={(e) => pickPlace(e.target.value)} aria-label="Pick a place in St Andrews">
          <option value="">Or pick a place in St Andrews…</option>
          {PLACES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </section>

      <section className="v-card">
        <h2>Getting there</h2>
        <Segmented value={form.transport} options={TRANSPORTS} labels={LABELS.transport}
          onChange={(t) => update({ transport: t, max_km: TRANSPORT_DEFAULT_KM[t] })} />
        <div className="v-field">
          <div className="v-between">
            <label className="v-label" htmlFor="v-maxkm">Max distance</label>
            <strong className="v-mono" style={{ color: 'var(--text)', fontSize: '0.85rem' }}>{formatKm(Number(form.max_km))}</strong>
          </div>
          <input id="v-maxkm" className="v-range" type="range" min="0.5" max={MAX_KM_LIMIT} step="0.5"
            value={form.max_km} onChange={(e) => update({ max_km: Number(e.target.value) })} />
        </div>
      </section>

      <section className="v-card">
        <h2>When you're free</h2>
        <AvailabilityGrid value={form.availability} onChange={(availability) => update({ availability })} />
      </section>

      <section className="v-card">
        <h2>Physical work, up to</h2>
        <Segmented value={form.physical_max} options={PHYSICAL_LEVELS} labels={LABELS.physical}
          onChange={(physical_max) => update({ physical_max })} />
        <h2>Experience</h2>
        <Segmented value={form.experience} options={EXPERIENCE_LEVELS} labels={LABELS.experience}
          onChange={(experience) => update({ experience })} />
      </section>

      <section className="v-card">
        <h2>Interests</h2>
        <Segmented multi wrap value={form.interests} options={CATEGORIES}
          onChange={(c) => update({ interests: form.interests.includes(c) ? form.interests.filter((x) => x !== c) : [...form.interests, c] })} />
      </section>

      {error && <p className="v-error" role="alert">{error}</p>}
      <div className="v-sticky-save">
        <button type="submit" className="v-btn v-btn-block" disabled={saving}>
          {saving ? 'Saving…' : saved ? <><Check size={18} strokeWidth={2} aria-hidden="true" />Saved</> : welcome ? 'Save and find shifts' : 'Save'}
        </button>
      </div>
    </form>
  );
}
