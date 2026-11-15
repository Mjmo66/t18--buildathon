// Shared constants and helpers for the charity space.
import { addMonths, addWeeks, endOfDay, format, isAfter } from 'date-fns';

export const CATEGORIES = [
  { value: 'environment', label: 'Environment' },
  { value: 'food', label: 'Food' },
  { value: 'elderly', label: 'Elderly' },
  { value: 'kids', label: 'Kids' },
  { value: 'animals', label: 'Animals' },
  { value: 'community', label: 'Community' },
  { value: 'events', label: 'Events' },
];

export const PHYSICAL_LEVELS = [
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: 'Heavy' },
];

export const EXPERIENCE_LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'some', label: 'Some' },
  { value: 'experienced', label: 'Experienced' },
];

export const RECURRENCES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

export const REQUEST_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'filled', label: 'Filled' },
  { value: 'closed', label: 'Closed' },
];

export const labelOf = (list, value) => list.find((o) => o.value === value)?.label ?? value ?? '—';

// St Andrews places. The shell may add `src/components/places.js` at merge; if it exists we use
// its list (export `places`, `PLACES` or default; items {name, lat, lng}), else this fallback.
const FALLBACK_PLACES = [
  { name: 'East Sands', lat: 56.3378, lng: -2.7826 },
  { name: 'West Sands', lat: 56.3497, lng: -2.8105 },
  { name: 'St Andrews Cathedral', lat: 56.3398, lng: -2.7868 },
  { name: 'Market Street', lat: 56.3402, lng: -2.7955 },
  { name: 'Students’ Association, North Street', lat: 56.3415, lng: -2.7958 },
  { name: 'Kinburn Park', lat: 56.3383, lng: -2.8034 },
  { name: 'Botanic Garden', lat: 56.3365, lng: -2.8058 },
  { name: 'Craigtoun Park', lat: 56.3163, lng: -2.8366 },
  { name: 'Lade Braes', lat: 56.3363, lng: -2.8031 },
  { name: 'St Andrews Harbour', lat: 56.3392, lng: -2.7836 },
];

const placeModules = import.meta.glob('../../components/places.js', { eager: true });
function loadPlaces() {
  const mod = Object.values(placeModules)[0];
  const list = mod && (mod.places || mod.PLACES || mod.default);
  if (Array.isArray(list) && list.length && list.every((p) => p && p.name && typeof p.lat === 'number')) {
    return list;
  }
  return FALLBACK_PLACES;
}
export const PLACES = loadPlaces();

// Charity numbers: OSCR SC+6 digits, CCEW 6–7 digits, CCNI NIC+6 digits.
export function normaliseCharityNumber(raw) {
  return (raw || '').toUpperCase().replace(/\s+/g, '');
}
export function detectRegister(num) {
  if (/^SC\d{6}$/.test(num)) return 'OSCR';
  if (/^NIC\d{6}$/.test(num)) return 'CCNI';
  if (/^\d{6,7}$/.test(num)) return 'CCEW';
  return null;
}
export const REGISTER_LABELS = {
  OSCR: 'OSCR (Scotland)',
  CCEW: 'Charity Commission (England & Wales)',
  CCNI: 'Charity Commission (Northern Ireland)',
};

/** Shift start dates of a request from `from` onwards (max n). */
export function nextShifts(request, n = 3, from = new Date()) {
  if (!request?.starts_at) return [];
  const start = new Date(request.starts_at);
  if (Number.isNaN(start.getTime())) return [];
  if (request.schedule_type !== 'recurring' || !request.recurrence) {
    return isAfter(start, from) ? [start] : [];
  }
  const last = request.ends_on ? endOfDay(new Date(`${request.ends_on}T00:00:00`)) : null;
  const step = (k) =>
    request.recurrence === 'weekly' ? addWeeks(start, k)
      : request.recurrence === 'fortnightly' ? addWeeks(start, 2 * k)
        : addMonths(start, k);
  const out = [];
  for (let k = 0; k < 520 && out.length < n; k++) {
    const d = step(k);
    if (last && isAfter(d, last)) break;
    if (isAfter(d, from)) out.push(d);
  }
  return out;
}

export const fmtShift = (d) => format(d, 'EEE d MMM, HH:mm');
export const fmtDate = (d) => format(d, 'd MMM yyyy');

export function fmtHours(h) {
  const n = Number(h) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function scheduleSummary(r) {
  if (r.schedule_type !== 'recurring') return `One-time · ${fmtShift(new Date(r.starts_at))}`;
  const rec = labelOf(RECURRENCES, r.recurrence);
  return r.ends_on ? `${rec} until ${fmtDate(new Date(`${r.ends_on}T00:00:00`))}` : rec;
}
