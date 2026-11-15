// Volunteer matching: pure functions, no React or Supabase. Tested by matching.test.mjs
// (`node --test src/features/matching/`). Rules: CONTRACT.md → Product rules → Matching.
import { addMonths, addWeeks } from 'date-fns';

export const TIME_ZONE = 'Europe/London';
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_LABELS = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
export const SLOTS = ['morning', 'afternoon', 'evening'];
/** Slot boundaries in local (Europe/London) hours: [from, to). */
export const SLOT_HOURS = { morning: [6, 12], afternoon: [12, 17], evening: [17, 22] };
export const PHYSICAL_LEVELS = ['light', 'moderate', 'heavy'];
export const EXPERIENCE_LEVELS = ['none', 'some', 'experienced'];
export const TRANSPORTS = ['walk', 'bike', 'bus', 'car'];
/** Default max distance (km) set when the volunteer picks a transport; they can edit it. */
export const TRANSPORT_DEFAULT_KM = { walk: 2, bike: 6, bus: 15, car: 30 };
export const CATEGORIES = ['environment', 'food', 'elderly', 'kids', 'animals', 'community', 'events'];

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in km between two {lat, lng} points. */
export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const hasCoords = (o) => o != null && Number.isFinite(Number(o.lat)) && Number.isFinite(Number(o.lng))
  && o.lat !== null && o.lng !== null;

const londonParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE, weekday: 'short', hour: 'numeric', hourCycle: 'h23',
});

/** Weekday + slot of a shift start in Europe/London: {weekday: 'sat', slot: 'morning'|null, hour}.
 *  slot is null outside 06–22. */
export function shiftSlot(date) {
  const parts = londonParts.formatToParts(new Date(date));
  const weekday = parts.find((p) => p.type === 'weekday').value.slice(0, 3).toLowerCase();
  const hour = Number(parts.find((p) => p.type === 'hour').value) % 24;
  const slot = SLOTS.find((s) => hour >= SLOT_HOURS[s][0] && hour < SLOT_HOURS[s][1]) ?? null;
  return { weekday, slot, hour };
}

/** Upcoming shift starts (Date[]) of a request, starting at `from`, at most `count`.
 *  One-time: its start if not past. Recurring: weekly / fortnightly / monthly until ends_on. */
export function nextShifts(request, from = new Date(), count = 5) {
  const start = new Date(request.starts_at);
  const fromMs = new Date(from).getTime();
  if (request.schedule_type !== 'recurring' || !request.recurrence) {
    return start.getTime() >= fromMs ? [start] : [];
  }
  const endMs = request.ends_on ? new Date(`${request.ends_on}T23:59:59`).getTime() : Infinity;
  const out = [];
  for (let i = 0; i < 1000 && out.length < count; i += 1) {
    const d = request.recurrence === 'weekly' ? addWeeks(start, i)
      : request.recurrence === 'fortnightly' ? addWeeks(start, 2 * i)
      : addMonths(start, i);
    if (d.getTime() > endMs) break;
    if (d.getTime() >= fromMs) out.push(d);
  }
  return out;
}

/** True if the availability grid has no slot ticked (treated as "any time"). */
export function isAvailabilityEmpty(availability) {
  return !availability || WEEKDAYS.every((d) => !(availability[d]?.length));
}

export function fitsAvailability(availability, date) {
  if (isAvailabilityEmpty(availability)) return true;
  const { weekday, slot } = shiftSlot(date);
  return slot != null && (availability[weekday] ?? []).includes(slot);
}

export function formatKm(km) {
  if (km < 10) return `${Math.max(0.1, Math.round(km * 10) / 10)} km`;
  return `${Math.round(km)} km`;
}

const rank = (list, v) => Math.max(0, list.indexOf(v));
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const DAY_MS = 86400000;

/**
 * Match one request against a volunteer's preferences.
 * @returns {{eligible: boolean, score: number, distanceKm: number|null, shiftAt: Date|null,
 *   reasons: string[], blockers: string[]}}
 *   reasons: why it fits (shown as chips); blockers: why it doesn't (empty when eligible).
 *   Score 0–100: closer (40), sooner (30), availability match (20), interest (10).
 */
export function matchRequest(prefs, request, now = new Date()) {
  const p = prefs ?? {};
  const reasons = [];
  const blockers = [];
  const maxKm = Number(p.max_km ?? TRANSPORT_DEFAULT_KM[p.transport] ?? 2);

  if (request.status && request.status !== 'open') blockers.push(request.status === 'filled' ? 'Filled' : 'Closed');

  // Distance
  let distanceKm = null;
  if (hasCoords(p) && hasCoords(request)) {
    distanceKm = haversineKm({ lat: Number(p.lat), lng: Number(p.lng) }, { lat: Number(request.lat), lng: Number(request.lng) });
    if (distanceKm <= maxKm) reasons.push(`${formatKm(distanceKm)} away`);
    else blockers.push(`${formatKm(distanceKm)} away (max ${formatKm(maxKm)})`);
  }

  // Time: first upcoming shift that fits the availability grid (look at the next 8)
  const upcoming = nextShifts(request, now, 8);
  const anyTime = isAvailabilityEmpty(p.availability);
  const fitting = upcoming.find((d) => fitsAvailability(p.availability, d)) ?? null;
  const shiftAt = fitting ?? upcoming[0] ?? null;
  if (!shiftAt) blockers.push('No upcoming shifts');
  else if (!fitting) {
    const { weekday, slot } = shiftSlot(shiftAt);
    blockers.push(slot ? `Not free ${WEEKDAY_LABELS[weekday]} ${slot}` : 'Outside 06:00–22:00');
  } else if (!anyTime) {
    const { weekday, slot } = shiftSlot(fitting);
    reasons.push(`Fits your ${WEEKDAY_LABELS[weekday]} ${slot}`);
  }

  // Physical level and experience
  const physicalMax = p.physical_max ?? 'moderate';
  if (rank(PHYSICAL_LEVELS, request.physical_level) > rank(PHYSICAL_LEVELS, physicalMax)) {
    blockers.push(`${capital(request.physical_level)} physical work`);
  } else if (request.physical_level === 'light') reasons.push('Light work');

  const exp = p.experience ?? 'none';
  if (rank(EXPERIENCE_LEVELS, request.experience) > rank(EXPERIENCE_LEVELS, exp)) {
    blockers.push(request.experience === 'experienced' ? 'Needs experienced volunteers' : 'Needs some experience');
  } else if ((request.experience ?? 'none') === 'none') reasons.push('No experience needed');

  const interest = request.category && (p.interests ?? []).includes(request.category);
  if (interest) reasons.push(`You like ${request.category}`);

  // Score
  let score = 0;
  score += distanceKm == null ? 20 : 40 * Math.max(0, 1 - distanceKm / Math.max(maxKm, 0.1));
  if (shiftAt) score += 30 * Math.max(0, 1 - (shiftAt.getTime() - new Date(now).getTime()) / (14 * DAY_MS));
  if (fitting) score += anyTime ? 10 : 20;
  if (interest) score += 10;

  return { eligible: blockers.length === 0, score: Math.round(score * 10) / 10, distanceKm, shiftAt, reasons, blockers };
}

/** Match and sort: eligible first, then by score (desc), then soonest shift. */
export function rankRequests(prefs, requests, now = new Date()) {
  return requests
    .map((request) => ({ request, match: matchRequest(prefs, request, now) }))
    .sort((a, b) => (Number(b.match.eligible) - Number(a.match.eligible))
      || (b.match.score - a.match.score)
      || ((a.match.shiftAt?.getTime() ?? Infinity) - (b.match.shiftAt?.getTime() ?? Infinity)));
}
