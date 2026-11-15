import type { Snapshot, Volunteer, TaskType } from './types';
const base: Omit<Volunteer, 'id' | 'name' | 'email' | 'verification'> = { postcode: 'EH6 5AB', coordinates: { lat: 55.973, lng: -3.175 }, available: true, maxDistanceMiles: 10, hasCar: true, willingToDrive: true, canDo: ['Food bank', 'Driving', 'Befriending', 'Events'], cannotDo: ['Heavy lifting'], weeklyAvailability: [{ day: 2, start: '09:00', end: '17:00' }, { day: 4, start: '09:00', end: '17:00' }, { day: 6, start: '09:00', end: '18:00' }], blockedDates: ['2026-11-28'], age: 29, dbs: true, physicalWork: true };
const tasks: { title: string; type: TaskType; location: string; postcode: string; date: string; start: string; end: string; needed: number; distance: number; description: string }[] = [
 { title: 'A little packing. A lot of good.', type: 'Food bank', location: 'Leith Community Hall', postcode: 'EH6 5AB', date: '2026-11-17', start: '10:00', end: '12:00', needed: 4, distance: 1.2, description: 'Join our friendly team to sort fresh produce and pack food parcels for local families.' },
 { title: 'Deliver a brighter afternoon', type: 'Driving', location: 'Leith & Newhaven', postcode: 'EH6 4LP', date: '2026-11-19', start: '13:00', end: '15:00', needed: 3, distance: 2.4, description: 'Deliver essential groceries to neighbours who cannot get out. A car and a friendly hello go a long way.' },
 { title: 'Tea, a chat and a friendly face', type: 'Befriending', location: 'Stockbridge Community Centre', postcode: 'EH3 5AB', date: '2026-11-21', start: '14:00', end: '15:30', needed: 2, distance: 3.1, description: 'Spend an afternoon sharing stories and a cup of tea with older people in our community.' },
 { title: 'Help our winter community day', type: 'Events', location: 'Leith Community Hall', postcode: 'EH6 5AB', date: '2026-11-21', start: '10:00', end: '13:00', needed: 5, distance: 1.2, description: 'Welcome visitors, help at activity tables and bring our neighbourhood together.' },
 { title: 'Keep our office organised', type: 'Admin', location: 'Thistle office, Leith', postcode: 'EH6 5AB', date: '2026-11-24', start: '10:00', end: '12:00', needed: 1, distance: 1.2, description: 'Help our small team organise donation records and prepare thank-you notes.' },
 { title: 'Set up the donation store', type: 'Heavy lifting', location: 'Newhaven donation store', postcode: 'EH6 4LP', date: '2026-11-26', start: '09:00', end: '11:00', needed: 2, distance: 2.4, description: 'Move donated boxes and set up shelves with the store team. This task involves physical work.' },
];
export const fixtures: Snapshot = {
 volunteers: [
  { ...base, id: 'v1', name: 'Isla Campbell', email: 'isla@example.test', verification: 'verified' },
  { ...base, id: 'v2', name: 'Jamie Reid', email: 'jamie@example.test', verification: 'pending' },
  { ...base, id: 'v3', name: 'Aisha Khan', email: 'aisha@example.test', verification: 'pending' },
  { ...base, id: 'v4', name: 'Lewis Stewart', email: 'lewis@example.test', verification: 'expired' },
  { ...base, id: 'v5', name: 'Erin MacLeod', email: 'erin@example.test', verification: 'rejected' },
  { ...base, id: 'v6', name: 'Callum Ross', email: 'callum@example.test', verification: 'verified' },
 ],
 charity: { id: 'c1', name: 'Thistle Community Care', email: 'hello@thistle.example.test', contactName: 'Fiona Murray', postcode: 'EH6 5AB', address: '14 Community Lane, Leith, Edinburgh', coordinates: { lat: 55.973, lng: -3.175 }, registrationNumber: 'SC000000 (fictional)', verification: 'pending', description: 'Neighbour by neighbour, we help people across Edinburgh feel supported, connected and cared for.' },
 requests: tasks.map((t, i) => ({ id: `r${i+1}`, charityId: 'c1', title: t.title, description: t.description, taskType: t.type, postcode: t.postcode, location: t.location, coordinates: { lat: 55.973 + i * 0.003, lng: -3.175 - i * 0.004 }, carNeeded: t.type === 'Driving', requirements: { dbs: t.type === 'Befriending', minimumAge: 18, physicalWork: t.type === 'Heavy lifting' }, volunteersNeeded: t.needed, status: 'open', schedule: i === 0 ? 'weekly' : 'one-off', occurrenceIds: [`o${i+1}`], distanceMiles: t.distance })),
 occurrences: tasks.map((t, i) => ({ id: `o${i+1}`, requestId: `r${i+1}`, start: `${t.date}T${t.start}:00Z`, end: `${t.date}T${t.end}:00Z` })),
 commitments: [{ id: 'k1', volunteerId: 'v1', occurrenceId: 'o4', status: 'accepted' }, { id: 'k2', volunteerId: 'v6', occurrenceId: 'o1', status: 'accepted' }, { id: 'k3', volunteerId: 'v6', occurrenceId: 'o5', status: 'accepted' }],
 verifications: [{ id: 'z1', subjectType: 'volunteer', subjectId: 'v2', submittedDate: '2026-11-13', status: 'pending' }, { id: 'z2', subjectType: 'volunteer', subjectId: 'v3', submittedDate: '2026-11-14', status: 'pending' }, { id: 'z3', subjectType: 'charity', subjectId: 'c1', submittedDate: '2026-11-12', status: 'pending' }],
};
