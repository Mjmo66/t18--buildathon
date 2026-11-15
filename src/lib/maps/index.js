// Maps: hand-off to Apple Maps / Google Maps, travel-time estimates and geocoding.
// No API keys. Deep links use the public URL schemes of both apps; geocoding uses Photon
// (komoot's open-source geocoder over OpenStreetMap, https://photon.komoot.io, fair use, no key).
// Pure functions are tested by maps.test.mjs (`node --test src/lib/maps/`).

/** St Andrews and surroundings; geocoding results outside this box are dropped. */
export const ST_ANDREWS_BBOX = { minLat: 56.30, maxLat: 56.38, minLng: -2.90, maxLng: -2.72 };
export const ST_ANDREWS_CENTRE = { lat: 56.3398, lng: -2.7967 };

/** Our transport values (features/matching TRANSPORTS) → each app's travel mode. */
const APPLE_DIRFLG = { walk: 'w', bike: 'b', bus: 'r', car: 'd' };
const GOOGLE_MODE = { walk: 'walking', bike: 'bicycling', bus: 'transit', car: 'driving' };

const coord = (n) => Number(n).toFixed(6).replace(/\.?0+$/, '');
const hasCoords = (p) => p != null && p.lat != null && p.lng != null
  && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

/**
 * Apple Maps directions link. Opens the Maps app on iPhone, iPad and Mac, maps.apple.com elsewhere.
 * dest: {lat, lng, label?}; transport: 'walk' | 'bike' | 'bus' | 'car'.
 */
export function appleMapsUrl(dest, transport = 'walk') {
  if (!hasCoords(dest)) return null;
  const q = new URLSearchParams({ daddr: `${coord(dest.lat)},${coord(dest.lng)}`, dirflg: APPLE_DIRFLG[transport] ?? 'w' });
  if (dest.label) q.set('q', dest.label);
  return `https://maps.apple.com/?${q}`;
}

/** Google Maps directions link (Maps URLs, no key). Opens the Google Maps app when installed. */
export function googleMapsUrl(dest, transport = 'walk') {
  if (!hasCoords(dest)) return null;
  const q = new URLSearchParams({
    api: '1',
    destination: `${coord(dest.lat)},${coord(dest.lng)}`,
    travelmode: GOOGLE_MODE[transport] ?? 'walking',
  });
  return `https://www.google.com/maps/dir/?${q}`;
}

/** 'apple' on Apple devices (iPadOS reports itself as a Mac with touch), otherwise 'google'. */
export function preferredMapsApp(nav = typeof navigator === 'undefined' ? null : navigator) {
  if (!nav) return 'google';
  const ua = nav.userAgent ?? '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'apple';
  if (/Macintosh/.test(ua)) return 'apple';
  return 'google';
}

/** Both links, preferred app first: [{app, label, url}]. Empty when the place has no coordinates. */
export function directionLinks(dest, transport = 'walk', nav) {
  const links = [
    { app: 'apple', label: 'Apple Maps', url: appleMapsUrl(dest, transport) },
    { app: 'google', label: 'Google Maps', url: googleMapsUrl(dest, transport) },
  ].filter((l) => l.url);
  const first = preferredMapsApp(nav);
  return links.sort((a, b) => (a.app === first ? -1 : b.app === first ? 1 : 0));
}

/**
 * Rough door-to-door minutes from a straight-line distance. Streets add about 30 % to the
 * straight line; speeds are typical for a small town. An estimate for cards ("10 min walk"),
 * not a route: the map apps give the real one.
 */
const SPEED_KMH = { walk: 4.8, bike: 15, bus: 20, car: 30 };
const OVERHEAD_MIN = { walk: 0, bike: 2, bus: 8, car: 4 };
export function travelMinutes(km, transport = 'walk') {
  if (km == null || !Number.isFinite(Number(km))) return null;
  const speed = SPEED_KMH[transport] ?? SPEED_KMH.walk;
  const mins = (Number(km) * 1.3 / speed) * 60 + (OVERHEAD_MIN[transport] ?? 0);
  return Math.max(1, Math.round(mins));
}

const TRANSPORT_WORD = { walk: 'walk', bike: 'by bike', bus: 'by bus', car: 'by car' };
/** "0.8 km · 13 min walk" */
export function formatTravel(km, transport = 'walk') {
  const mins = travelMinutes(km, transport);
  if (mins == null) return '';
  const dist = km < 1 ? `${Math.round(km * 1000 / 50) * 50} m` : `${Number(km).toFixed(1)} km`;
  return `${dist} · ${mins} min ${TRANSPORT_WORD[transport] ?? 'walk'}`;
}

export function inStAndrews(p, box = ST_ANDREWS_BBOX) {
  return hasCoords(p) && p.lat >= box.minLat && p.lat <= box.maxLat && p.lng >= box.minLng && p.lng <= box.maxLng;
}

/** Photon GeoJSON feature → {address, lat, lng}. Address reads like "12 Market Street, St Andrews". */
export function featureToPlace(f) {
  const [lng, lat] = f?.geometry?.coordinates ?? [];
  const p = f?.properties ?? {};
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const town = p.city ?? p.town ?? p.village ?? p.locality ?? p.district;
  const parts = [p.name && p.name !== street ? p.name : null, street || null, town ?? null]
    .filter((x, i, a) => x && a.indexOf(x) === i);
  return { address: parts.join(', ') || null, lat, lng };
}

const PHOTON = 'https://photon.komoot.io';
const bboxParam = (b) => [b.minLng, b.minLat, b.maxLng, b.maxLat].join(',');

/**
 * Address search near St Andrews: [{address, lat, lng}], best first. Call it debounced (300 ms+)
 * and pass an AbortSignal; Photon throttles heavy use.
 */
export async function searchAddress(query, { signal, limit = 5, fetchImpl = fetch } = {}) {
  const q = query?.trim();
  if (!q || q.length < 3) return [];
  const params = new URLSearchParams({
    q, limit: String(limit), lang: 'en',
    lat: String(ST_ANDREWS_CENTRE.lat), lon: String(ST_ANDREWS_CENTRE.lng),
    bbox: bboxParam(ST_ANDREWS_BBOX),
  });
  const res = await fetchImpl(`${PHOTON}/api/?${params}`, { signal });
  if (!res.ok) throw new Error('Address search is not available right now.');
  const body = await res.json();
  return (body.features ?? []).map(featureToPlace).filter((p) => p.address && inStAndrews(p));
}

/** Nearest address for a point (for "Use my location"): {address, lat, lng} or null. */
export async function reverseGeocode({ lat, lng }, { signal, fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), lang: 'en', limit: '1' });
  // Buildings and streets only; otherwise Photon often answers with a bare postcode.
  params.append('layer', 'house');
  params.append('layer', 'street');
  const res = await fetchImpl(`${PHOTON}/reverse?${params}`, { signal });
  if (!res.ok) return null;
  const f = (await res.json()).features?.[0];
  if (!f) return null;
  // Keep the user's own point; only borrow the address text.
  return { ...featureToPlace(f), lat, lng };
}
