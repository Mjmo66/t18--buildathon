import { addMinutes, format } from 'date-fns';
import { Award, Clock, Medal, Repeat, Sprout } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/** Badge catalogue; `icon` is a lucide-react component. */
export const BADGES = [
  { code: 'first_shift', label: 'First shift', icon: Sprout, progress: (p) => [p.shifts, 1, 'shift'] },
  { code: 'five_hours', label: '5 hours', icon: Clock, progress: (p) => [p.hours, 5, 'h'] },
  { code: 'twenty_hours', label: '20 hours', icon: Medal, progress: (p) => [p.hours, 20, 'h'] },
  { code: 'regular', label: 'Regular: 5 shifts', icon: Repeat, progress: (p) => [p.shifts, 5, 'shifts'] },
];

export const badgeByCode = (code) =>
  BADGES.find((b) => b.code === code) ?? { code, label: code, icon: Award };

export const POINTS_PER_HOUR = 10;
export const MAX_WARNINGS = 3;

export const pointsFor = (hours) => Math.round(Number(hours || 0) * POINTS_PER_HOUR);

export function formatHours(h) {
  const n = Number(h || 0);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} h`;
}

/** "Sat 21 Nov, 10:00–12:00" */
export function formatShift(startIso, durationHours) {
  if (!startIso) return '';
  const start = new Date(startIso);
  const label = format(start, 'EEE d MMM, HH:mm');
  if (!durationHours) return label;
  return `${label}–${format(addMinutes(start, Number(durationHours) * 60), 'HH:mm')}`;
}

export function formatDate(iso) {
  return iso ? format(new Date(iso), 'd MMM yyyy') : '';
}

/** Short code printed under the QR for manual entry (prefix of checkin_code). */
export const shortCode = (code) => (code ?? '').slice(0, 6).toUpperCase();

export async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
