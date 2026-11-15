// Small presentational helpers for the volunteer pages (replace with src/components/ui/ once it exists).
import { format, isToday, isTomorrow } from 'date-fns';
import './user.css';

export function Loading() {
  return <div className="v-loading" role="status" aria-label="Loading"><div className="v-spinner" /></div>;
}

export function Empty({ icon, children, action }) {
  return (
    <div className="v-card v-empty">
      {icon && <span className="v-empty-icon" aria-hidden="true">{icon}</span>}
      <div>{children}</div>
      {action}
    </div>
  );
}

/** Small mono metadata item with a leading icon. */
export function Meta({ icon: I, children }) {
  return <span className="v-meta-item">{I && <I size={14} strokeWidth={1.75} aria-hidden="true" />}{children}</span>;
}

export function Chips({ yes = [], no = [], plain = [] }) {
  if (!yes.length && !no.length && !plain.length) return null;
  return (
    <div className="v-chips">
      {no.map((r) => <span key={`n-${r}`} className="v-chip v-chip-no">{r}</span>)}
      {yes.map((r) => <span key={`y-${r}`} className="v-chip">{r}</span>)}
      {plain.map((r) => <span key={`p-${r}`} className="v-chip v-chip-plain">{r}</span>)}
    </div>
  );
}

/** "Today 10:00", "Tomorrow 14:30", "Sat 21 Nov, 10:00". */
export function formatWhen(date) {
  const d = new Date(date);
  if (isToday(d)) return `Today ${format(d, 'HH:mm')}`;
  if (isTomorrow(d)) return `Tomorrow ${format(d, 'HH:mm')}`;
  return format(d, 'EEE d MMM, HH:mm');
}

export function formatHours(h) {
  const n = Number(h);
  return `${n % 1 === 0 ? n : n.toFixed(1)} h`;
}

export const LABELS = {
  physical: { light: 'Light', moderate: 'Moderate', heavy: 'Heavy' },
  experience: { none: 'None', some: 'Some', experienced: 'Experienced' },
  transport: { walk: 'Walk', bike: 'Bike', bus: 'Bus', car: 'Car' },
  recurrence: { weekly: 'Every week', fortnightly: 'Every 2 weeks', monthly: 'Every month' },
};

export const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
