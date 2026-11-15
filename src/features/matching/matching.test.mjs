import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineKm, shiftSlot, nextShifts, matchRequest, rankRequests, TRANSPORT_DEFAULT_KM,
  TIME_GROUPS, availabilityFromGroups, groupsFromAvailability, fitsAvailability,
} from './index.js';
import { PLACES } from './places.js';

const place = (name) => PLACES.find((p) => p.name === name);
const NOW = new Date('2026-11-16T09:00:00Z'); // Monday; London = UTC in November

const prefs = {
  lat: place('Market Street').lat, lng: place('Market Street').lng, max_km: 2, transport: 'walk',
  availability: { sat: ['morning'] }, physical_max: 'moderate', experience: 'none', interests: ['environment'],
};
const beachClean = {
  id: 'r1', status: 'open', title: 'Beach clean', category: 'environment', schedule_type: 'one_time',
  starts_at: '2026-11-21T10:00:00Z', duration_hours: 2, recurrence: null, ends_on: null,
  physical_level: 'light', experience: 'none', lat: place('East Sands').lat, lng: place('East Sands').lng,
};

test('haversine: known distance and symmetry', () => {
  // Edinburgh Castle → St Andrews Market Street ≈ 49 km as the crow flies
  const d = haversineKm({ lat: 55.9486, lng: -3.1999 }, place('Market Street'));
  assert.ok(d > 45 && d < 52, `got ${d}`);
  assert.equal(haversineKm(place('Harbour'), place('Harbour')), 0);
  assert.ok(Math.abs(haversineKm(place('Harbour'), place('West Sands')) - haversineKm(place('West Sands'), place('Harbour'))) < 1e-9);
});

test('shiftSlot uses Europe/London and slot boundaries', () => {
  assert.deepEqual(shiftSlot('2026-11-21T10:00:00Z'), { weekday: 'sat', slot: 'morning', hour: 10 });
  assert.equal(shiftSlot('2026-11-21T12:00:00Z').slot, 'afternoon');
  assert.equal(shiftSlot('2026-11-21T17:00:00Z').slot, 'evening');
  assert.equal(shiftSlot('2026-11-21T22:00:00Z').slot, null);
  assert.equal(shiftSlot('2026-11-21T05:59:00Z').slot, null);
  // Summer time: 11:30 UTC is 12:30 BST → afternoon
  assert.equal(shiftSlot('2026-07-04T11:30:00Z').slot, 'afternoon');
  // 23:30 UTC on Sunday in summer is 00:30 Monday in London
  assert.equal(shiftSlot('2026-07-05T23:30:00Z').weekday, 'mon');
});

test('nextShifts: one-time and recurring with end date', () => {
  assert.equal(nextShifts(beachClean, NOW).length, 1);
  assert.equal(nextShifts({ ...beachClean, starts_at: '2026-11-01T10:00:00Z' }, NOW).length, 0);
  const weekly = { ...beachClean, schedule_type: 'recurring', recurrence: 'weekly', starts_at: '2026-11-07T10:00:00Z', ends_on: '2026-12-05' };
  const shifts = nextShifts(weekly, NOW, 10);
  assert.deepEqual(shifts.map((d) => d.toISOString().slice(0, 10)), ['2026-11-21', '2026-11-28', '2026-12-05']);
  const fortnightly = { ...weekly, recurrence: 'fortnightly', ends_on: null };
  assert.deepEqual(nextShifts(fortnightly, NOW, 2).map((d) => d.toISOString().slice(0, 10)), ['2026-11-21', '2026-12-05']);
});

test('matchRequest: the demo beach clean fits with readable reasons', () => {
  const m = matchRequest(prefs, beachClean, NOW);
  assert.equal(m.eligible, true);
  assert.ok(m.distanceKm > 0.5 && m.distanceKm < 1.5);
  assert.ok(m.reasons.some((r) => /km away$/.test(r)));
  assert.ok(m.reasons.includes('Fits your Saturday morning'));
  assert.ok(m.reasons.includes('No experience needed'));
  assert.deepEqual(m.blockers, []);
});

test('matchRequest: each rule can make a request ineligible', () => {
  const far = matchRequest(prefs, { ...beachClean, lat: place('Craigtoun Park').lat, lng: place('Craigtoun Park').lng }, NOW);
  assert.equal(far.eligible, false);
  assert.match(far.blockers[0], /max 2 km/);
  assert.equal(matchRequest(prefs, { ...beachClean, starts_at: '2026-11-21T14:00:00Z' }, NOW).eligible, false);
  assert.equal(matchRequest(prefs, { ...beachClean, physical_level: 'heavy' }, NOW).eligible, false);
  assert.equal(matchRequest(prefs, { ...beachClean, experience: 'some' }, NOW).eligible, false);
  assert.equal(matchRequest({ ...prefs, experience: 'experienced' }, { ...beachClean, experience: 'some' }, NOW).eligible, true);
  assert.equal(matchRequest(prefs, { ...beachClean, starts_at: '2026-11-01T10:00:00Z' }, NOW).eligible, false);
});

test('matchRequest: empty availability means any time; missing coordinates skip distance', () => {
  const m = matchRequest({ ...prefs, availability: {}, lat: null, lng: null }, { ...beachClean, starts_at: '2026-11-18T19:00:00Z' }, NOW);
  assert.equal(m.eligible, true);
  assert.equal(m.distanceKm, null);
});

test('recurring request picks the first shift that fits the availability', () => {
  const monthly = { ...beachClean, schedule_type: 'recurring', recurrence: 'monthly', starts_at: '2026-10-17T10:00:00Z' }; // 17th each month
  // 2026-11-17 Tue, 2026-12-17 Thu, 2027-01-17 Sun, ..., 2027-04-17 Sat
  const m = matchRequest(prefs, monthly, NOW);
  assert.equal(m.eligible, true);
  assert.equal(m.shiftAt.toISOString().slice(0, 10), '2027-04-17');
});

test('ranking: eligible first, closer and sooner score higher', () => {
  const nearSoon = { ...beachClean, id: 'near', lat: place('Market Street').lat, lng: place('Market Street').lng };
  const later = { ...beachClean, id: 'later', starts_at: '2026-11-28T10:00:00Z' };
  const bad = { ...beachClean, id: 'bad', physical_level: 'heavy' };
  const ids = rankRequests(prefs, [bad, later, beachClean, nearSoon], NOW).map((x) => x.request.id);
  assert.deepEqual(ids, ['near', 'r1', 'later', 'bad']);
});

test('transport defaults', () => {
  assert.deepEqual(TRANSPORT_DEFAULT_KM, { walk: 2, bike: 6, bus: 15, car: 30 });
});

test('time toggles: no group is any time ({}), which matches every shift slot', () => {
  assert.deepEqual(availabilityFromGroups([]), {});
  assert.deepEqual(groupsFromAvailability({}), []);
  assert.equal(fitsAvailability(availabilityFromGroups([]), new Date('2026-11-18T19:00:00Z')), true);
});

test('time toggles: each group stores exactly its slots and reads back as itself', () => {
  for (const g of Object.keys(TIME_GROUPS)) {
    const av = availabilityFromGroups([g]);
    assert.deepEqual(groupsFromAvailability(av), [g]);
  }
  assert.deepEqual(availabilityFromGroups(['weekdayMornings']).sat, undefined);
  assert.deepEqual(availabilityFromGroups(['weekends']).sun, ['morning', 'afternoon', 'evening']);
  assert.deepEqual(availabilityFromGroups(['evenings', 'weekdayMornings']).mon, ['morning', 'evening']);
});

test('time toggles: a group shows on when any of its stored slots is ticked', () => {
  assert.deepEqual(groupsFromAvailability({ sat: ['morning'] }), ['weekends']);
  assert.deepEqual(groupsFromAvailability({ wed: ['afternoon'], sun: ['morning'] }), ['weekdayAfternoons', 'weekends']);
  // A shared slot alone (Sunday evening) lights both groups that contain it; with a weekday evening, only Evenings.
  assert.deepEqual(groupsFromAvailability({ sun: ['evening'] }), ['evenings', 'weekends']);
  assert.deepEqual(groupsFromAvailability({ tue: ['evening'], sun: ['evening'] }), ['evenings']);
  // Saving writes the full set of every group that is on.
  assert.equal(availabilityFromGroups(groupsFromAvailability({ wed: ['afternoon'] })).fri.includes('afternoon'), true);
});
