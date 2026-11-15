import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featureToPlace, leadingHouseNumber, mergePlaces, metresBetween, searchAddress } from './address.js';
import { displayWebsite, normaliseWebsite, safeWebsite } from './website.js';

const feature = (props, coords = [-2.79, 56.34]) => ({ geometry: { coordinates: coords }, properties: { countrycode: 'GB', ...props } });

test('a building reads as name, number and street, town and postcode', () => {
  const p = featureToPlace(feature({ type: 'house', name: 'Byre Theatre', street: 'Abbey Street', city: 'St Andrews', postcode: 'KY16 9LA' }));
  assert.equal(p.address, 'Byre Theatre, Abbey Street, St Andrews KY16 9LA');
  assert.deepEqual([p.lat, p.lng], [56.34, -2.79]);
});

test('a street result keeps the house number the user typed', () => {
  const f = feature({ type: 'street', name: 'North Street', city: 'St Andrews', postcode: 'KY16 9AA' });
  assert.equal(featureToPlace(f, { houseNumber: '71' }).address, '71 North Street, St Andrews KY16 9AA');
  assert.equal(featureToPlace(f).address, 'North Street, St Andrews KY16 9AA');
});

test('house numbers are read only from the start of the query', () => {
  assert.equal(leadingHouseNumber('71b North St'), '71b');
  assert.equal(leadingHouseNumber('Flat 2, 7 North St'), null);
  assert.equal(leadingHouseNumber('KY16 9AL'), null);
});

test('local results come first; duplicates and places outside the UK are dropped', () => {
  const a = { address: 'A, St Andrews', lat: 1, lng: 1, country: 'GB' };
  const b = { address: 'B, Edinburgh', lat: 2, lng: 2, country: 'GB' };
  const ie = { address: 'C, Dublin', lat: 3, lng: 3, country: 'IE' };
  assert.deepEqual(mergePlaces([a], [b, a, ie]).map((p) => p.address), ['A, St Andrews', 'B, Edinburgh']);
});

test('results with more of the typed words rank first', () => {
  const south = { address: 'School of History, 71 South Street, St Andrews', lat: 1, lng: 1, country: 'GB' };
  const north = { address: '71 North Street, St Andrews', lat: 2, lng: 2, country: 'GB' };
  assert.deepEqual(mergePlaces([south, north], [], 6, '71 north st').map((p) => p.address)[0], north.address);
});

test('search shows an error only when both searches fail', async () => {
  await assert.rejects(searchAddress('north street', { fetchImpl: async () => ({ ok: false }) }));
  let n = 0;
  const flaky = async () => (n++ === 0 ? { ok: false } : { ok: true, json: async () => ({ features: [feature({ type: 'house', housenumber: '1', street: 'X Road', city: 'Y' })] }) });
  assert.equal((await searchAddress('x road', { fetchImpl: flaky })).length, 1);
});

test('search puts local results before UK-wide ones', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    const local = url.includes('bbox=-3.30');
    const f = local
      ? feature({ type: 'house', housenumber: '6', street: 'North Street', city: 'St Andrews' })
      : feature({ type: 'house', housenumber: '6', street: 'North Street', city: 'Leeds' }, [-1.5, 53.8]);
    return { ok: true, json: async () => ({ features: [f] }) };
  };
  const out = await searchAddress('6 north st', { fetchImpl });
  assert.ok(urls.some((u) => u.includes('bbox=-8.70')), 'also searches the whole UK');
  assert.deepEqual(out.map((p) => p.address), ['6 North Street, St Andrews', '6 North Street, Leeds']);
  assert.deepEqual(await searchAddress('ab', { fetchImpl }), []);
});

test('distance between two nearby points', () => {
  const d = metresBetween({ lat: 56.34, lng: -2.79 }, { lat: 56.341, lng: -2.79 });
  assert.ok(d > 100 && d < 120);
});

test('websites: scheme added, only http(s) links rendered', () => {
  assert.equal(normaliseWebsite('example.org'), 'https://example.org/');
  assert.equal(normaliseWebsite(''), null);
  assert.throws(() => normaliseWebsite('javascript:alert(1)'));
  assert.throws(() => normaliseWebsite('not a site'));
  assert.equal(safeWebsite('javascript:alert(1)'), null);
  assert.equal(displayWebsite('https://www.example.org/'), 'example.org');
});
