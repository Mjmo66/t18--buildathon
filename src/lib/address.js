// UK address search and reverse geocoding for address fields. No API key: Photon
// (komoot's open-source geocoder over OpenStreetMap, https://photon.komoot.io, fair use).
// Results near St Andrews come first, then the rest of Great Britain and Northern Ireland.
// Pure helpers are tested by address.test.mjs (`node --test src/lib/`).

const PHOTON = 'https://photon.komoot.io';
export const ST_ANDREWS = { lat: 56.3398, lng: -2.7967 };
/** North East Fife and Dundee: searched first so local streets beat same-named ones elsewhere. */
const LOCAL_BBOX = '-3.30,56.15,-2.55,56.50';
/** The UK (minus Shetland's far tip); results outside GB are dropped anyway. */
const UK_BBOX = '-8.70,49.80,1.80,60.90';

/** Photon GeoJSON feature → {address, lat, lng}, e.g. "Byre Theatre, Abbey Street, St Andrews KY16 9LA". */
export function featureToPlace(f, { houseNumber } = {}) {
  const [lng, lat] = f?.geometry?.coordinates ?? [];
  const p = f?.properties ?? {};
  // A street result for "71 North Street": keep the number the user typed.
  const number = p.housenumber ?? (p.type === 'street' && houseNumber ? houseNumber : null);
  const streetName = p.street ?? (p.type === 'street' ? p.name : null);
  const street = [number, streetName].filter(Boolean).join(' ');
  const town = p.city ?? p.town ?? p.village ?? p.locality ?? p.district;
  const townLine = [town, p.postcode].filter(Boolean).join(' ');
  const name = p.name && p.name !== streetName && p.name !== p.postcode ? p.name : null;
  const parts = [name, street || null, townLine || null].filter((x, i, a) => x && a.indexOf(x) === i);
  return { address: parts.join(', ') || null, lat, lng, country: p.countrycode ?? null };
}

/** "71b North St" → "71b"; null when the query does not start with a house number. */
export function leadingHouseNumber(query) {
  const m = /^\s*(\d+[a-z]?)(?:[\s,]|$)/i.exec(query ?? '');
  return m ? m[1] : null;
}

const ABBREV = { st: 'street', rd: 'road', ave: 'avenue', pl: 'place', sq: 'square', cres: 'crescent', ter: 'terrace', dr: 'drive', ln: 'lane' };
/** Lower-case words of a query with abbreviations expanded ("6 Market St" → ["6", "market", "street"]). */
export function queryWords(query) {
  return (query ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map((w) => ABBREV[w] ?? w);
}

/**
 * Local results first, then national ones; duplicates and non-UK results dropped. Results that
 * contain more of the typed words move up ("71 North St" → North Street before South Street).
 */
export function mergePlaces(local, national, limit = 6, query = '') {
  const words = queryWords(query);
  const score = (p) => {
    const have = new Set(p.address.toLowerCase().split(/[^a-z0-9]+/));
    return words.filter((w) => have.has(w)).length;
  };
  const seen = new Set();
  const all = [];
  for (const p of [...local, ...national]) {
    if (!p.address || p.country !== 'GB' || seen.has(p.address)) continue;
    seen.add(p.address);
    all.push({ address: p.address, lat: p.lat, lng: p.lng, score: score(p), order: all.length });
  }
  return all
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ address, lat, lng }) => ({ address, lat, lng }));
}

async function photon(path, params, { signal, fetchImpl = fetch }) {
  const res = await fetchImpl(`${PHOTON}${path}?${params}`, { signal });
  if (!res.ok) throw new Error('Address search is not available right now.');
  return (await res.json()).features ?? [];
}

/**
 * Address search: [{address, lat, lng}], best first. Call it debounced (300 ms+) with an
 * AbortSignal; Photon throttles heavy use.
 */
export async function searchAddress(query, { signal, limit = 6, fetchImpl = fetch } = {}) {
  const typed = query?.trim();
  if (!typed || typed.length < 3) return [];
  const q = queryWords(typed).join(' '); // Photon does not expand "St" or "Rd"
  const base = { q, limit: String(limit), lang: 'en', lat: String(ST_ANDREWS.lat), lon: String(ST_ANDREWS.lng) };
  const opts = { signal, fetchImpl };
  const houseNumber = leadingHouseNumber(typed);
  const searches = [
    photon('/api/', new URLSearchParams({ ...base, bbox: LOCAL_BBOX }), opts),
    photon('/api/', new URLSearchParams({ ...base, bbox: UK_BBOX, zoom: '12' }), opts),
  ];
  // OpenStreetMap lacks many house numbers: also look for the street itself nearby.
  const street = houseNumber ? q.slice(q.indexOf(' ') + 1) : '';
  if (street.length >= 3) searches.push(photon('/api/', new URLSearchParams({ ...base, q: street, bbox: LOCAL_BBOX }), opts));
  const [local, national, localStreet] = await Promise.allSettled(searches);
  if (local.status === 'rejected' && national.status === 'rejected') throw local.reason;
  const places = (r) => (r?.status === 'fulfilled' ? r.value.map((f) => featureToPlace(f, { houseNumber })) : []);
  const streets = places(localStreet).filter((p) => p.address.startsWith(`${houseNumber} `));
  return mergePlaces([...places(local), ...streets], places(national), limit, q);
}

/** Distance in metres between two {lat, lng} points (haversine). */
export function metresBetween(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * Nearest building address for a device position {lat, lng, accuracy}: {address, lat, lng} or null.
 * Uses the building's own point when it lies within the position's accuracy (it is where
 * volunteers should go); otherwise keeps the device's point.
 */
export async function reverseGeocode(pos, { signal, fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({ lat: String(pos.lat), lon: String(pos.lng), lang: 'en', limit: '1' });
  params.append('layer', 'house'); // otherwise Photon often answers with a bare postcode
  const [f] = await photon('/reverse', params, { signal, fetchImpl });
  if (!f) return null;
  const place = featureToPlace(f);
  if (!place.address) return null;
  const near = metresBetween(pos, place) <= Math.max(pos.accuracy ?? 0, 40);
  return near ? { address: place.address, lat: place.lat, lng: place.lng } : { address: place.address, lat: pos.lat, lng: pos.lng };
}

/** Browser position {lat, lng, accuracy (m)}; rejects with a readable Error. Fresh fix, high accuracy. */
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => reject(new Error(err.code === 1
        ? 'Location permission was denied. Type the address instead.'
        : 'Could not get your location. Type the address instead.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

/** Map link to check a pinned point (Apple Maps on Apple devices, Google Maps elsewhere). */
export function mapLink({ lat, lng }, nav = typeof navigator === 'undefined' ? null : navigator) {
  const ll = `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
  return /iPhone|iPad|iPod|Macintosh/.test(nav?.userAgent ?? '')
    ? `https://maps.apple.com/?ll=${ll}&q=${ll}`
    : `https://www.google.com/maps/search/?api=1&query=${ll}`;
}
