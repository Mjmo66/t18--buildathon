import { formatDuration, formatLongDate, formatShiftRange } from '../../components/format.js';
import { Award, Clock, Medal, Repeat, Sprout } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/** Badge catalogue; `icon` is a lucide-react component. */
export const BADGES = [
  { code: 'first_shift', label: 'First shift', icon: Sprout, progress: (p) => [p.shifts, 1, 'shift'] },
  { code: 'five_hours', label: '5 hours', icon: Clock, progress: (p) => [p.hours, 5, 'hours'] },
  { code: 'twenty_hours', label: '20 hours', icon: Medal, progress: (p) => [p.hours, 20, 'hours'] },
  { code: 'regular', label: 'Regular: 5 shifts', icon: Repeat, progress: (p) => [p.shifts, 5, 'shifts'] },
];

export const badgeByCode = (code) =>
  BADGES.find((b) => b.code === code) ?? { code, label: code, icon: Award };

export const POINTS_PER_HOUR = 10;
export const MAX_WARNINGS = 3;

export const pointsFor = (hours) => Math.round(Number(hours || 0) * POINTS_PER_HOUR);

/** "2 hours", "1½ hours". */
export function formatHours(h) {
  return formatDuration(h);
}

/** "Saturday 21 November, 10am to 12pm" */
export function formatShift(startIso, durationHours) {
  if (!startIso) return '';
  return formatShiftRange(startIso, durationHours);
}

/** "21 November 2026" */
export function formatDate(iso) {
  return iso ? formatLongDate(iso) : '';
}

/** Short code printed under the QR for manual entry (prefix of checkin_code). */
export const shortCode = (code) => (code ?? '').slice(0, 6).toUpperCase();

export async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
