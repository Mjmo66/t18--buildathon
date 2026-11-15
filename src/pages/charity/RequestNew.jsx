import { useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { Button, useToast } from '../../components/ui/index.js';
import { formatDuration, formatTime } from '../../components/format.js';
import { CharityGate, Empty, ErrorNote, PlacePicker, VerifyButton } from './components.jsx';
import {
  CATEGORIES, EXPERIENCE_LEVELS, PHYSICAL_LEVELS, RECURRENCES, fmtShift, nextShifts, volunteers,
} from './shared.js';

const initial = () => ({
  title: '',
  description: '',
  category: '',
  schedule_type: 'one_time',
  recurrence: 'weekly',
  ends_on: '',
  date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  time: '10:00',
  duration_hours: '2',
  slots: '4',
  physical_level: 'light',
  experience: 'none',
  experience_notes: '',
});

function validate(f, loc) {
  const e = {};
  if (!f.title.trim()) e.title = 'Give the task a name.';
  else if (f.title.trim().length > 120) e.title = 'Keep the title under 120 characters.';
  if (!f.category) e.category = 'Choose a category.';
  const start = new Date(`${f.date}T${f.time}`);
  if (!f.date || !f.time || Number.isNaN(start.getTime())) e.date = 'Choose a date and a start time.';
  else if (start <= new Date()) e.date = 'Choose a time that is still to come.';
  const dur = Number(f.duration_hours);
  if (!(dur > 0 && dur <= 24)) e.duration_hours = 'Choose between half an hour and 24 hours.';
  const slots = Number(f.slots);
  if (!(Number.isInteger(slots) && slots >= 1 && slots <= 500)) e.slots = 'Ask for at least 1 volunteer.';
  if (f.schedule_type === 'recurring') {
    if (!f.ends_on) e.ends_on = 'Choose the last date.';
    else if (f.date && f.ends_on < f.date) e.ends_on = 'The last date must be on or after the first date.';
  }
  if (!loc.address.trim()) e.location = 'Enter an address or choose a place.';
  else if (loc.lat == null) e.location = 'Choose a place or use your location so volunteers nearby can find it.';
  return { errors: e, start };
}

/** Big radio cards with words (no dropdown, so every choice is visible). */
function RadioCards({ name, value, options, onChange, label }) {
  return (
    <div className="ch-radio-cards" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.value} className={`ch-radio-card ${value === o.value ? 'is-active' : ''}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span className="ch-radio-text">
            <strong>{o.label}</strong>
            {o.detail && <span>{o.detail}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

/** − value + with words, for small numbers. */
function Stepper({ label, value, display, onChange, step, min, max, lessLabel, moreLabel, error }) {
  const id = useId();
  const n = Number(value) || 0;
  const clamp = (x) => Math.min(max, Math.max(min, Math.round(x * 10) / 10));
  return (
    <div className="ch-field">
      <span id={`${id}-l`}>{label}</span>
      <div className="ch-stepper" role="group" aria-labelledby={`${id}-l`}>
        <Button
          variant="secondary"
          className="ch-stepper-btn"
          aria-label={lessLabel}
          disabled={n <= min}
          hint={n <= min ? 'This is the lowest it can go.' : lessLabel}
          onClick={() => onChange(String(clamp(n - step)))}
        >
          −
        </Button>
        <output className="ch-stepper-value" aria-live="polite">{display}</output>
        <Button
          variant="secondary"
          className="ch-stepper-btn"
          aria-label={moreLabel}
          disabled={n >= max}
          hint={n >= max ? 'This is the highest it can go.' : moreLabel}
          onClick={() => onChange(String(clamp(n + step)))}
        >
          +
        </Button>
      </div>
      {error}
    </div>
  );
}

/** "Monday 16 November 2026" for a yyyy-MM-dd field value. */
function spellDate(v) {
  if (!v) return '';
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : format(d, 'EEEE d MMMM yyyy');
}
function spellTime(v) {
  if (!v) return '';
  const d = new Date(`2000-01-01T${v}`);
  return Number.isNaN(d.getTime()) ? '' : formatTime(d);
}

function Form() {
  const { user, charity } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [loc, setLoc] = useState({
    address: charity.address ?? '', lat: charity.lat ?? null, lng: charity.lng ?? null,
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  const setVal = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));
  // Experience notes only make sense with "Some experience"; clear them when another level is chosen.
  const setExperience = (v) => setF((prev) => ({ ...prev, experience: v, experience_notes: v === 'some' ? prev.experience_notes : '' }));
  const recurring = f.schedule_type === 'recurring';

  const preview = useMemo(() => {
    if (!recurring) return [];
    const start = new Date(`${f.date}T${f.time}`);
    if (Number.isNaN(start.getTime())) return [];
    return nextShifts({
      schedule_type: 'recurring', recurrence: f.recurrence, starts_at: start.toISOString(), ends_on: f.ends_on || null,
    }, 3);
  }, [recurring, f.date, f.time, f.recurrence, f.ends_on]);

  if (!charity.verified_at) {
    return (
      <section className="ch-page">
        <h1>Ask for volunteers</h1>
        <Empty>
          <p>We need to check your charity before you can ask for volunteers.</p>
          <VerifyButton />
        </Empty>
      </section>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    const { errors: errs, start } = validate(f, loc);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const { data, error } = await supabase.from('requests').insert({
      charity_id: user.id,
      title: f.title.trim(),
      description: f.description.trim(),
      category: f.category,
      schedule_type: f.schedule_type,
      starts_at: start.toISOString(),
      duration_hours: Number(f.duration_hours),
      recurrence: recurring ? f.recurrence : null,
      ends_on: recurring ? f.ends_on : null,
      slots: Number(f.slots),
      physical_level: f.physical_level,
      experience: f.experience,
      experience_notes: f.experience_notes.trim() || null,
      address: loc.address.trim(),
      lat: loc.lat,
      lng: loc.lng,
    }).select('id').single();
    setBusy(false);
    if (error) { setSubmitError(error); return; }
    toast('Posted.', 'success');
    navigate(`/charity/requests/${data.id}`, { replace: true });
  };

  const err = (k) => errors[k] && <small className="ch-error">{errors[k]}</small>;

  return (
    <section className="ch-page ch-page-form">
      <Link className="back-link" to="/charity/requests">
        <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />Back to my requests
      </Link>
      <h1>Ask for volunteers</h1>
      <form className="ch-form" onSubmit={submit} noValidate>
        <fieldset className="ch-card">
          <legend>1. What&rsquo;s the task?</legend>
          <label className="ch-field">
            <span>Name of the task</span>
            <input value={f.title} onChange={set('title')} placeholder="Beach clean at East Sands" maxLength={120} />
            {err('title')}
          </label>
          <label className="ch-field">
            <span>What will volunteers do?</span>
            <textarea value={f.description} onChange={set('description')} rows={4} />
          </label>
          <label className="ch-field">
            <span>Type of task</span>
            <select value={f.category} onChange={set('category')}>
              <option value="">Choose…</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {err('category')}
          </label>
        </fieldset>

        <fieldset className="ch-card">
          <legend>2. When?</legend>
          <RadioCards
            name="schedule_type"
            label="Once or repeating"
            value={f.schedule_type}
            onChange={setVal('schedule_type')}
            options={[{ value: 'one_time', label: 'Just once' }, { value: 'recurring', label: 'It repeats' }]}
          />
          <div className="ch-grid2">
            <label className="ch-field">
              <span>{recurring ? 'First date' : 'Date'}</span>
              <input type="date" value={f.date} onChange={set('date')} />
              {spellDate(f.date) && <span className="ch-spelled">{spellDate(f.date)}</span>}
            </label>
            <label className="ch-field">
              <span>Start time</span>
              <input type="time" value={f.time} onChange={set('time')} step={900} />
              {spellTime(f.time) && <span className="ch-spelled">Starts at {spellTime(f.time)}</span>}
            </label>
          </div>
          {err('date')}
          {recurring && (
            <>
              <div className="ch-field">
                <span>How often?</span>
                <RadioCards name="recurrence" label="How often" value={f.recurrence} onChange={setVal('recurrence')} options={RECURRENCES} />
              </div>
              <label className="ch-field">
                <span>Last date</span>
                <input type="date" value={f.ends_on} min={f.date} onChange={set('ends_on')} />
                {spellDate(f.ends_on) && <span className="ch-spelled">{spellDate(f.ends_on)}</span>}
                {err('ends_on')}
              </label>
              {preview.length > 0 && (
                <div className="ch-preview">
                  <span className="ch-field-label">Next dates</span>
                  <ul className="ch-plain">{preview.map((d) => <li key={d.toISOString()}>{fmtShift(d)}</li>)}</ul>
                </div>
              )}
            </>
          )}
          <div className="ch-grid2">
            <Stepper
              label="How long?"
              value={f.duration_hours}
              display={formatDuration(f.duration_hours)}
              onChange={setVal('duration_hours')}
              step={0.5}
              min={0.5}
              max={24}
              lessLabel="Half an hour less"
              moreLabel="Half an hour more"
              error={err('duration_hours')}
            />
            <Stepper
              label="How many volunteers?"
              value={f.slots}
              display={volunteers(Number(f.slots) || 0)}
              onChange={setVal('slots')}
              step={1}
              min={1}
              max={500}
              lessLabel="One volunteer fewer"
              moreLabel="One volunteer more"
              error={err('slots')}
            />
          </div>
        </fieldset>

        <fieldset className="ch-card">
          <legend>3. Who can help?</legend>
          <div className="ch-field">
            <span>How physical is it?</span>
            <RadioCards name="physical_level" label="How physical is it?" value={f.physical_level} onChange={setVal('physical_level')} options={PHYSICAL_LEVELS} />
          </div>
          <div className="ch-field">
            <span>Do they need experience?</span>
            <RadioCards name="experience" label="Do they need experience?" value={f.experience} onChange={setExperience} options={EXPERIENCE_LEVELS} />
          </div>
          {f.experience === 'some' && (
            <label className="ch-field">
              <span>Experience notes</span>
              <input value={f.experience_notes} onChange={set('experience_notes')} placeholder="e.g. food hygiene certificate helpful" />
            </label>
          )}
        </fieldset>

        <fieldset className="ch-card">
          <legend>4. Where?</legend>
          <PlacePicker value={loc} onChange={setLoc} idPrefix="req" />
          {err('location')}
        </fieldset>

        <ErrorNote error={submitError} />
        {Object.keys(errors).length > 0 && <p className="ch-error" role="alert">Fix the answers in red.</p>}
        <div className="ch-sticky-bar">
          <Button type="submit" size="lg" block loading={busy}>{busy ? 'Posting…' : 'Post this request'}</Button>
        </div>
      </form>
    </section>
  );
}

export default function RequestNew() {
  return <CharityGate><Form /></CharityGate>;
}
