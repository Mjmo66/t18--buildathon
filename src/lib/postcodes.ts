import type { Coordinates } from "@/api/types";

// Approximate centre points for Edinburgh postcode districts. Mock data only:
// swap for a real postcode lookup when there is a backend.
const EDINBURGH_DISTRICTS: Record<string, Coordinates> = {
  EH1: { lat: 55.9533, lng: -3.1883 },
  EH2: { lat: 55.954, lng: -3.196 },
  EH3: { lat: 55.95, lng: -3.205 },
  EH4: { lat: 55.965, lng: -3.255 },
  EH5: { lat: 55.977, lng: -3.21 },
  EH6: { lat: 55.973, lng: -3.175 },
  EH7: { lat: 55.96, lng: -3.165 },
  EH8: { lat: 55.948, lng: -3.17 },
  EH9: { lat: 55.933, lng: -3.185 },
  EH10: { lat: 55.92, lng: -3.21 },
  EH11: { lat: 55.935, lng: -3.245 },
  EH12: { lat: 55.943, lng: -3.275 },
  EH13: { lat: 55.905, lng: -3.24 },
  EH14: { lat: 55.91, lng: -3.265 },
  EH15: { lat: 55.95, lng: -3.11 },
  EH16: { lat: 55.92, lng: -3.15 },
  EH17: { lat: 55.905, lng: -3.145 },
};

const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

/** "eh65ab" → "EH6 5AB". Returns the trimmed input unchanged if it isn't postcode-shaped. */
export function normalisePostcode(input: string): string {
  const compact = input.toUpperCase().replace(/\s+/g, "");
  if (!FULL_POSTCODE.test(compact)) return input.trim();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function isValidPostcode(input: string): boolean {
  return FULL_POSTCODE.test(input.toUpperCase().replace(/\s+/g, ""));
}

function district(input: string): string {
  return normalisePostcode(input).split(" ")[0] ?? "";
}

/** Coordinates for an Edinburgh postcode, or null if it's outside the prototype's area. */
export function coordinatesForPostcode(input: string): Coordinates | null {
  if (!isValidPostcode(input)) return null;
  return EDINBURGH_DISTRICTS[district(input)] ?? null;
}

export function isCoveredPostcode(input: string): boolean {
  return coordinatesForPostcode(input) !== null;
}

const EARTH_RADIUS_MILES = 3958.8;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Straight-line distance in miles (haversine). */
export function milesBetween(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}
