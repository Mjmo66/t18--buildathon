// Plain-English formatting for older UK users: short and readable ("Thu 19 Nov, 1–4pm"), 12-hour times, miles.
// Shared by every area. Times are shown in the viewer's local time (the app runs in St Andrews).
import { differenceInCalendarDays, format } from 'date-fns';

const toDate = (d) => (d instanceof Date ? d : new Date(d));

/** "Today", "Tomorrow", or "Thu 19 Nov" (year added when it isn't this year). */
export function formatDay(d, now = new Date()) {
  const date = toDate(d);
  const diff = differenceInCalendarDays(date, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return format(date, date.getFullYear() === now.getFullYear() ? 'EEE d MMM' : 'EEE d MMM yyyy');
}

/** "19 November 2026" (no weekday): for "until …" and certificates. */
export function formatLongDate(d) {
  return format(toDate(d), 'd MMMM yyyy');
}

/** "2pm", "2:30pm", "10am". */
export function formatTime(d) {
  const date = toDate(d);
  return format(date, date.getMinutes() === 0 ? 'haaa' : 'h:mmaaa');
}

/** "Thu 19 Nov, 2pm". */
export function formatDayTime(d, now = new Date()) {
  return `${formatDay(d, now)}, ${formatTime(d)}`;
}

/** "Thu 19 Nov, 2–4pm" (or "11am–1pm" across noon) for a shift of `hours`. */
export function formatShiftRange(start, hours, now = new Date()) {
  const s = toDate(start);
  if (!hours) return formatDayTime(s, now);
  const e = new Date(s.getTime() + Number(hours) * 3600000);
  const sameHalf = (s.getHours() < 12) === (e.getHours() < 12);
  const from = sameHalf ? formatTime(s).replace(/[ap]m$/, '') : formatTime(s);
  return `${formatDay(s, now)}, ${from}–${formatTime(e)}`;
}

/** "2 hrs", "1 hr", "1½ hrs", "45 min". */
export function formatDuration(hours) {
  const h = Number(hours || 0);
  if (h > 0 && h < 1) return `${Math.round(h * 60)} min`;
  const whole = Math.floor(h);
  const half = Math.abs(h - whole - 0.5) < 0.01;
  if (half) return `${whole || ''}½ hrs`;
  const r = Math.round(h * 10) / 10;
  return `${r} ${r === 1 ? 'hr' : 'hrs'}`;
}

const KM_PER_MILE = 1.609344;
/** Stored km → "0.6 miles away". */
export function formatMiles(km) {
  if (km == null || Number.isNaN(km)) return '';
  const mi = km / KM_PER_MILE;
  if (mi < 0.1) return 'Very close';
  const v = mi < 10 ? Math.round(mi * 10) / 10 : Math.round(mi);
  return `${v} ${v === 1 ? 'mile' : 'miles'} away`;
}

/** Walking time when the volunteer walks ("10 min walk", "Very close" under 3 min), else miles. ~5 km/h. */
export function formatDistance(km, transport) {
  if (km == null || Number.isNaN(km)) return '';
  if (transport === 'walk') {
    const exact = (km / 5) * 60;
    if (exact < 3) return 'Very close';
    const min = exact < 10 ? Math.round(exact) : Math.round(exact / 5) * 5;
    if (min >= 60) return formatMiles(km);
    return `${min} min walk`;
  }
  return formatMiles(km);
}

/** Miles → km for storing a distance chosen in miles. */
export const milesToKm = (mi) => mi * KM_PER_MILE;
