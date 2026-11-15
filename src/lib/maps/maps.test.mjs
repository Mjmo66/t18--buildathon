import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appleMapsUrl, googleMapsUrl, preferredMapsApp, directionLinks, travelMinutes, formatTravel,
  featureToPlace, searchAddress, reverseGeocode, inStAndrews,
} from './index.js';

const eastSands = { lat: 56.3376, lng: -2.7826, label: 'East Sands Beach Clean' };
const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15' };
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 Chrome/142.0' };

test('Apple Maps link carries the destination and travel mode', () => {
  const u = new URL(appleMapsUrl(eastSands, 'walk'));
  assert.equal(u.origin, 'https://maps.apple.com');
  assert.equal(u.searchParams.get('daddr'), '56.3376,-2.7826');
  assert.equal(u.searchParams.get('dirflg'), 'w');
  assert.equal(u.searchParams.get('q'), 'East Sands Beach Clean');
  assert.equal(new URL(appleMapsUrl(eastSands, 'car')).searchParams.get('dirflg'), 'd');
});

test('Google Maps link uses the keyless Maps URLs format', () => {
  const u = new URL(googleMapsUrl(eastSands, 'bus'));
  assert.equal(u.origin + u.pathname, 'https://www.google.com/maps/dir/');
  assert.equal(u.searchParams.get('api'), '1');
  assert.equal(u.searchParams.get('destination'), '56.3376,-2.7826');
  assert.equal(u.searchParams.get('travelmode'), 'transit');
});

test('no link without coordinates', () => {
  assert.equal(appleMapsUrl({ lat: null, lng: null }), null);
  assert.equal(googleMapsUrl(undefined), null);
  assert.deepEqual(directionLinks({ lat: null, lng: 1 }), []);
});

test('Apple devices get Apple Maps first, others Google Maps', () => {
  assert.equal(preferredMapsApp(IPHONE), 'apple');
  assert.equal(preferredMapsApp(ANDROID), 'google');
  assert.deepEqual(directionLinks(eastSands, 'walk', IPHONE).map((l) => l.app), ['apple', 'google']);
  assert.deepEqual(directionLinks(eastSands, 'walk', ANDROID).map((l) => l.app), ['google', 'apple']);
});

test('travel estimate grows with distance and is faster on wheels', () => {
  assert.ok(travelMinutes(2, 'walk') > travelMinutes(1, 'walk'));
  assert.ok(travelMinutes(3, 'bike') < travelMinutes(3, 'walk'));
  assert.equal(travelMinutes(0, 'walk'), 1);
  assert.equal(travelMinutes(null), null);
  assert.match(formatTravel(0.8, 'walk'), /^800 m · \d+ min walk$/);
  assert.match(formatTravel(1.6, 'bike'), /^1\.6 km · \d+ min by bike$/);
});

test('Photon features become readable St Andrews addresses', () => {
  const f = {
    geometry: { coordinates: [-2.7955, 56.3402] },
    properties: { housenumber: '12', street: 'Market Street', city: 'St Andrews' },
  };
  assert.deepEqual(featureToPlace(f), { address: '12 Market Street, St Andrews', lat: 56.3402, lng: -2.7955 });
  const named = { geometry: { coordinates: [-2.7866, 56.3398] }, properties: { name: 'St Andrews Cathedral', city: 'St Andrews' } };
  assert.equal(featureToPlace(named).address, 'St Andrews Cathedral, St Andrews');
});

test('address search biases to St Andrews and drops far-away results', async () => {
  let called;
  const fetchImpl = async (url) => {
    called = new URL(url);
    return {
      ok: true,
      json: async () => ({ features: [
        { geometry: { coordinates: [-2.7955, 56.3402] }, properties: { street: 'Market Street', city: 'St Andrews' } },
        { geometry: { coordinates: [-3.19, 55.95] }, properties: { street: 'Market Street', city: 'Edinburgh' } },
      ] }),
    };
  };
  const out = await searchAddress('market street', { fetchImpl });
  assert.equal(called.hostname, 'photon.komoot.io');
  assert.ok(called.searchParams.get('bbox'));
  assert.equal(out.length, 1);
  assert.ok(inStAndrews(out[0]));
  assert.deepEqual(await searchAddress('ab', { fetchImpl: () => assert.fail('no call for short input') }), []);
});

test('reverse geocode keeps the user\'s own point', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ features: [{ geometry: { coordinates: [-2.8, 56.34] }, properties: { street: 'North Street', city: 'St Andrews' } }] }),
  });
  assert.deepEqual(await reverseGeocode({ lat: 56.3411, lng: -2.7942 }, { fetchImpl }),
    { address: 'North Street, St Andrews', lat: 56.3411, lng: -2.7942 });
});
