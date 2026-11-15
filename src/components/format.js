// Plain-English formatting for older UK users: full weekday names, 12-hour times, miles.
// Shared by every area. Times are shown in the viewer's local time (the app runs in St Andrews).
import { differenceInCalendarDays, format } from 'date-fns';

const toDate = (d) => (d instanceof Date ? d : new Date(d));

/** "Today", "Tomorrow", or "Thursday 19 November" (year added when it isn't this year). */
export function formatDay(d, now = new Date()) {
  const date = toDate(d);
  const diff = differenceInCalendarDays(date, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return format(date, date.getFullYear() === now.getFullYear() ? 'EEEE d MMMM' : 'EEEE d MMMM yyyy');
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

/** "Thursday 19 November, 2pm". */
export function formatDayTime(d, now = new Date()) {
  return `${formatDay(d, now)}, ${formatTime(d)}`;
}

/** "Thursday 19 November, 2pm to 4pm" for a shift of `hours`. */
export function formatShiftRange(start, hours, now = new Date()) {
  const s = toDate(start);
  if (!hours) return formatDayTime(s, now);
  const e = new Date(s.getTime() + Number(hours) * 3600000);
  return `${formatDay(s, now)}, ${formatTime(s)} to ${formatTime(e)}`;
}

/** "2 hours", "1 hour", "1½ hours", "45 minutes". */
export function formatDuration(hours) {
  const h = Number(hours || 0);
  if (h > 0 && h < 1) return `${Math.round(h * 60)} minutes`;
  const whole = Math.floor(h);
  const half = Math.abs(h - whole - 0.5) < 0.01;
  if (half) return `${whole || ''}½ hours`;
  const r = Math.round(h * 10) / 10;
  return `${r} ${r === 1 ? 'hour' : 'hours'}`;
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

/** Walking time when the volunteer walks ("10 minutes' walk"), else miles. ~5 km/h. */
export function formatDistance(km, transport) {
  if (km == null || Number.isNaN(km)) return '';
  if (transport === 'walk') {
    const min = Math.max(1, Math.round((km / 5) * 60 / 5) * 5 || 1);
    if (min >= 60) return formatMiles(km);
    return `${min} ${min === 1 ? "minute's" : "minutes'"} walk`;
  }
  return formatMiles(km);
}

/** Miles → km for storing a distance chosen in miles. */
export const milesToKm = (mi) => mi * KM_PER_MILE;
