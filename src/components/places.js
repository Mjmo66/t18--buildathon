// Real St Andrews places with fixed coordinates, for location pickers and seed data.
export const ST_ANDREWS_CENTRE = { lat: 56.3398, lng: -2.7967 };

export const PLACES = [
  { id: 'market-street', name: 'Market Street', lat: 56.3402, lng: -2.7955 },
  { id: 'north-street', name: 'North Street', lat: 56.3411, lng: -2.7942 },
  { id: 'east-sands', name: 'East Sands', lat: 56.3376, lng: -2.7826 },
  { id: 'west-sands', name: 'West Sands', lat: 56.3497, lng: -2.8104 },
  { id: 'harbour', name: 'Harbour', lat: 56.3392, lng: -2.7858 },
  { id: 'kinburn-park', name: 'Kinburn Park', lat: 56.3387, lng: -2.8018 },
  { id: 'lade-braes', name: 'Lade Braes', lat: 56.3365, lng: -2.8045 },
  { id: 'craigtoun-park', name: 'Craigtoun Park', lat: 56.3197, lng: -2.8415 },
];

/** Address string used when a place is picked, e.g. "East Sands, St Andrews". */
export function placeAddress(place) {
  return `${place.name}, St Andrews`;
}

export function findPlace(id) {
  return PLACES.find((p) => p.id === id) ?? null;
}

/** Browser geolocation as a promise of {lat, lng}. Rejects with an Error that has a readable message. */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(err.code === 1 ? 'Location permission was denied. Pick a place instead.' : 'Could not get your location. Pick a place instead.'),
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}
