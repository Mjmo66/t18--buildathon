/** Google Maps search link for a place, e.g. "Leith Community Hall, EH6 5AB, UK". */
export function googleMapsUrl(location: string, postcode?: string): string {
  const query = [location, postcode, "UK"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
