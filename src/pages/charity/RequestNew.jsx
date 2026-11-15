import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import { CharityGate, Empty, ErrorNote, PlacePicker, VerifyButton } from './components.jsx';
import {
  CATEGORIES, EXPERIENCE_LEVELS, PHYSICAL_LEVELS, RECURRENCES, fmtShift, nextShifts,
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
  if (!f.title.trim()) e.title = 'Enter a title.';
  else if (f.title.trim().length > 120) e.title = 'Keep the title under 120 characters.';
  if (!f.category) e.category = 'Choose a category.';
  const start = new Date(`${f.date}T${f.time}`);
  if (!f.date || !f.time || Number.isNaN(start.getTime())) e.date = 'Enter a start date and time.';
  else if (start <= new Date()) e.date = 'The start must be in the future.';
  const dur = Number(f.duration_hours);
  if (!(dur > 0 && dur <= 24)) e.duration_hours = 'Between 0.5 and 24 hours.';
  const slots = Number(f.slots);
  if (!(Number.isInteger(slots) && slots >= 1 && slots <= 500)) e.slots = 'A whole number from 1.';
  if (f.schedule_type === 'recurring') {
    if (!f.ends_on) e.ends_on = 'Choose an end date.';
    else if (f.date && f.ends_on < f.date) e.ends_on = 'The end date must be on or after the start date.';
  }
  if (!loc.address.trim()) e.location = 'Enter an address or choose a place.';
  else if (loc.lat == null) e.location = 'Choose a place or use your location so volunteers nearby can find it.';
  return { errors: e, start };
}

function Form() {
  const { user, charity } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState(initial);
  const [loc, setLoc] = useState({
    address: charity.address ?? '', lat: charity.lat ?? null, lng: charity.lng ?? null,
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));
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
        <h1>New request</h1>
        <Empty>
          <p>Only verified charities can post requests.</p>
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
    navigate(`/charity/requests/${data.id}`, { replace: true });
  };

  const err = (k) => errors[k] && <small className="ch-error">{errors[k]}</small>;

  return (
    <section className="ch-page">
      <header className="page-head">
        <h1>New request</h1>
        <Link className="ch-btn-secondary" to="/charity/requests">Cancel</Link>
      </header>
      <form className="ch-form" onSubmit={submit} noValidate>
        <fieldset className="ch-card">
          <legend>What</legend>
          <label className="ch-field">
            <span>Title</span>
            <input value={f.title} onChange={set('title')} placeholder="Beach clean at East Sands" maxLength={120} />
            {err('title')}
          </label>
          <label className="ch-field">
            <span>Description</span>
            <textarea value={f.description} onChange={set('description')} rows={4} />
          </label>
          <label className="ch-field">
            <span>Category</span>
            <select value={f.category} onChange={set('category')}>
              <option value="">Choose…</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {err('category')}
          </label>
        </fieldset>

        <fieldset className="ch-card">
          <legend>When</legend>
          <div className="ch-segment" role="radiogroup" aria-label="Schedule">
            {[['one_time', 'One-time'], ['recurring', 'Recurring']].map(([v, l]) => (
              <label key={v} className={f.schedule_type === v ? 'is-active' : ''}>
                <input type="radio" name="schedule_type" value={v} checked={f.schedule_type === v} onChange={set('schedule_type')} />
                {l}
              </label>
            ))}
          </div>
          <div className="ch-grid2">
            <label className="ch-field">
              <span>{recurring ? 'First date' : 'Date'}</span>
              <input type="date" value={f.date} onChange={set('date')} />
            </label>
            <label className="ch-field">
              <span>Start time</span>
              <input type="time" value={f.time} onChange={set('time')} step={900} />
            </label>
          </div>
          {err('date')}
          {recurring && (
            <div className="ch-grid2">
              <label className="ch-field">
                <span>Repeats</span>
                <select value={f.recurrence} onChange={set('recurrence')}>
                  {RECURRENCES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <label className="ch-field">
                <span>Until</span>
                <input type="date" value={f.ends_on} min={f.date} onChange={set('ends_on')} />
                {err('ends_on')}
              </label>
            </div>
          )}
          {recurring && preview.length > 0 && (
            <div className="ch-small">
              <span className="ch-muted">Next shifts: </span>
              <span className="mono">{preview.map(fmtShift).join(' · ')}</span>
            </div>
          )}
          <div className="ch-grid2">
            <label className="ch-field">
              <span>Duration (hours)</span>
              <input type="number" inputMode="decimal" min="0.5" max="24" step="0.5" value={f.duration_hours} onChange={set('duration_hours')} />
              {err('duration_hours')}
            </label>
            <label className="ch-field">
              <span>Volunteers needed</span>
              <input type="number" inputMode="numeric" min="1" step="1" value={f.slots} onChange={set('slots')} />
              {err('slots')}
            </label>
          </div>
        </fieldset>

        <fieldset className="ch-card">
          <legend>Who</legend>
          <div className="ch-grid2">
            <label className="ch-field">
              <span>Physical level</span>
              <select value={f.physical_level} onChange={set('physical_level')}>
                {PHYSICAL_LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="ch-field">
              <span>Experience required</span>
              <select value={f.experience} onChange={set('experience')}>
                {EXPERIENCE_LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <label className="ch-field">
            <span>Experience notes</span>
            <input value={f.experience_notes} onChange={set('experience_notes')} placeholder="e.g. food hygiene certificate helpful" />
          </label>
        </fieldset>

        <fieldset className="ch-card">
          <legend>Where</legend>
          <PlacePicker value={loc} onChange={setLoc} idPrefix="req" />
          {err('location')}
        </fieldset>

        <ErrorNote error={submitError} />
        {Object.keys(errors).length > 0 && <p className="ch-error">Please fix the fields marked above.</p>}
        <button className="button ch-btn-block" disabled={busy}>{busy ? 'Posting…' : 'Post request'}</button>
      </form>
    </section>
  );
}

export default function RequestNew() {
  return <CharityGate><Form /></CharityGate>;
}
