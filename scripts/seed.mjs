// Demo seed for Kindred. Idempotent: run it as often as you like.
//   npm run seed        (reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.seed)
// All charities and people are fictional; places are real St Andrews locations.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.seed).');
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const PASSWORD = 'demo-pass-2026';
const DOMAIN = 'demo.kindred.uk';
const TEST_DOMAIN = 'test.kindred.uk';
// Every seeded name and listing says it is not real.
const DEMO = ' (demo)';
const TEST = ' (test)';

const P = {
  market: { name: 'Market Street', lat: 56.3402, lng: -2.7955 },
  north: { name: 'North Street', lat: 56.3411, lng: -2.7942 },
  east: { name: 'East Sands', lat: 56.3376, lng: -2.7826 },
  west: { name: 'West Sands', lat: 56.3497, lng: -2.8104 },
  harbour: { name: 'Harbour', lat: 56.3392, lng: -2.7858 },
  kinburn: { name: 'Kinburn Park', lat: 56.3387, lng: -2.8018 },
  lade: { name: 'Lade Braes', lat: 56.3365, lng: -2.8045 },
  craigtoun: { name: 'Craigtoun Park', lat: 56.3197, lng: -2.8415 },
  south: { name: 'South Street', lat: 56.3388, lng: -2.7960 },
  cathedral: { name: 'Cathedral', lat: 56.3398, lng: -2.7866 },
  botanic: { name: 'Botanic Garden', lat: 56.3366, lng: -2.8065 },
  haugh: { name: 'University halls (North Haugh)', lat: 56.3428, lng: -2.8080 },
  bus: { name: 'Bus station', lat: 56.3404, lng: -2.8003 },
};
const at = (p) => ({ address: `${p.name}, St Andrews`, lat: p.lat, lng: p.lng });

// Demo registry. Seeded demo charities use 101-103, 105, 107, 108; test charities use 109-110.
// Free for live sign-ups and for testing the check: SC900104, SC900106, SC900111, SC900112.
const REGISTRY = [
  { charity_number: 'SC900101', org_name: 'East Neuk Beach Guardians', register: 'OSCR' },
  { charity_number: 'SC900102', org_name: 'Fife Food Share Network', register: 'OSCR' },
  { charity_number: 'SC900103', org_name: 'Kinburn Companions', register: 'OSCR' },
  { charity_number: 'SC900104', org_name: 'Lade Braes Wildlife Trust', register: 'OSCR' },
  { charity_number: 'SC900105', org_name: 'St Andrews Reading Buddies', register: 'OSCR' },
  { charity_number: 'SC900106', org_name: 'Craigtoun Green Spaces', register: 'OSCR' },
  { charity_number: 'SC900107', org_name: 'Harbour Paws Rescue', register: 'OSCR' },
  { charity_number: 'SC900108', org_name: 'Kingdom Warm Spaces', register: 'OSCR' },
  { charity_number: 'SC900109', org_name: 'Test Charity 1', register: 'OSCR' },
  { charity_number: 'SC900110', org_name: 'Test Charity 2', register: 'OSCR' },
  { charity_number: 'SC900111', org_name: 'Test Charity 3', register: 'OSCR' },
  { charity_number: 'SC900112', org_name: 'Test Charity 4', register: 'OSCR' },
].map((g) => ({ ...g, org_name: g.org_name + (g.org_name.startsWith('Test') ? TEST : DEMO) }));

const CHARITIES = [
  { key: 'beach', email: 'beachguardians', name: 'East Neuk Beach Guardians', number: 'SC900101', place: P.harbour },
  { key: 'food', email: 'foodshare', name: 'Fife Food Share Network', number: 'SC900102', place: P.market },
  { key: 'companions', email: 'companions', name: 'Kinburn Companions', number: 'SC900103', place: P.kinburn },
  { key: 'reading', email: 'readingbuddies', name: 'St Andrews Reading Buddies', number: 'SC900105', place: P.south },
  { key: 'paws', email: 'harbourpaws', name: 'Harbour Paws Rescue', number: 'SC900107', place: P.harbour },
  { key: 'warm', email: 'warmspaces', name: 'Kingdom Warm Spaces', number: 'SC900108', place: P.cathedral },
];

const VOLUNTEERS = [
  {
    key: 'isla', name: 'Isla Murray', place: P.north, max_km: 2, transport: 'walk', physical_max: 'moderate', experience: 'none',
    availability: { tue: ['evening'], thu: ['afternoon'], sat: ['morning', 'afternoon'] }, interests: ['environment', 'animals'],
  },
  {
    key: 'ewan', name: 'Ewan Reid', place: P.market, max_km: 5, transport: 'bike', physical_max: 'heavy', experience: 'some',
    availability: { mon: ['afternoon'], wed: ['afternoon', 'evening'], sat: ['morning'], sun: ['morning'] }, interests: ['environment', 'food'],
  },
  {
    key: 'priya', name: 'Priya Nair', place: P.lade, max_km: 3, transport: 'walk', physical_max: 'light', experience: 'experienced',
    availability: { mon: ['evening'], wed: ['evening'], fri: ['afternoon'], sun: ['afternoon'] }, interests: ['elderly', 'kids'],
  },
  {
    key: 'tom', name: 'Tom Fraser', place: P.east, max_km: 10, transport: 'bus', physical_max: 'moderate', experience: 'some',
    availability: { tue: ['morning', 'afternoon'], thu: ['morning'], sat: ['afternoon'] }, interests: ['food', 'elderly'],
  },
  {
    key: 'sofia', name: 'Sofia Rossi', place: P.west, max_km: 4, transport: 'bike', physical_max: 'heavy', experience: 'none',
    availability: { wed: ['morning'], fri: ['morning', 'afternoon'], sat: ['morning'], sun: ['morning', 'afternoon'] }, interests: ['environment', 'kids'],
  },
  {
    key: 'jamie', name: 'Jamie Campbell', place: P.haugh, max_km: 3, transport: 'walk', physical_max: 'moderate', experience: 'some',
    availability: { mon: ['afternoon', 'evening'], wed: ['afternoon'], sat: ['morning', 'afternoon'] }, interests: ['animals', 'kids'],
  },
  {
    key: 'hannah', name: 'Hannah Wilson', place: P.south, max_km: 2, transport: 'walk', physical_max: 'light', experience: 'experienced',
    availability: { tue: ['afternoon', 'evening'], thu: ['afternoon', 'evening'], sun: ['afternoon'] }, interests: ['kids', 'community', 'elderly'],
  },
  {
    key: 'leo', name: 'Leo Martin', place: P.bus, max_km: 8, transport: 'car', physical_max: 'heavy', experience: 'none',
    availability: { fri: ['afternoon', 'evening'], sat: ['morning', 'afternoon', 'evening'], sun: ['morning'] }, interests: ['animals', 'food', 'community'],
  },
];

// Test accounts: plain names, no history. Charity 1 and 2 are verified, charity 3 has no charity
// profile yet (tests sign-up and the register check: use SC900111), volunteer 4 has no
// preferences and is not verified.
const TEST_CHARITIES = [
  { key: 't_charity1', email: 'charity1', name: 'Test Charity 1', number: 'SC900109', place: P.market },
  { key: 't_charity2', email: 'charity2', name: 'Test Charity 2', number: 'SC900110', place: P.north },
  { key: 't_charity3', email: 'charity3', name: 'Test Charity 3', number: null },
];
const TEST_VOLUNTEERS = [
  { key: 't_vol1', email: 'volunteer1', name: 'Test Volunteer 1', place: P.market },
  { key: 't_vol2', email: 'volunteer2', name: 'Test Volunteer 2', place: P.north },
  { key: 't_vol3', email: 'volunteer3', name: 'Test Volunteer 3', place: P.south },
  { key: 't_vol4', email: 'volunteer4', name: 'Test Volunteer 4', place: null },
];
// Open every day, any time: test volunteers see every test shift.
const ALL_TIMES = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  .map((d) => [d, ['morning', 'afternoon', 'evening']]));

// A date `days` from today at hh:mm local time (the demo runs in the UK).
function day(days, hh, mm = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hh, mm, 0, 0);
  return d;
}
const iso = (d) => d.toISOString();
const dateOnly = (d) => iso(d).slice(0, 10);

// Requests: titles are unique per charity, which is how reruns find them again.
const REQUESTS = [
  { charity: 'beach', title: 'Beach clean at East Sands', category: 'environment', schedule_type: 'one_time', starts: day(2, 10), duration_hours: 2, slots: 12, physical_level: 'light', experience: 'none', place: P.east,
    description: 'Litter picking along the tideline. Gloves, bags and pickers provided. Wear sturdy shoes.' },
  { charity: 'beach', title: 'West Sands dune planting', category: 'environment', schedule_type: 'one_time', starts: day(6, 9, 30), duration_hours: 3, slots: 8, physical_level: 'heavy', experience: 'none', place: P.west,
    description: 'Planting marram grass to protect the dunes. Spades provided; expect digging and carrying.' },
  { charity: 'beach', title: 'Harbour rockpool survey', category: 'environment', schedule_type: 'recurring', recurrence: 'fortnightly', starts: day(4, 14), duration_hours: 2, slots: 4, physical_level: 'moderate', experience: 'some', experience_notes: 'Basic species ID helps; we bring guides.', place: P.harbour,
    description: 'Recording what lives in the harbour rockpools at low tide for our marine log.' },
  { charity: 'beach', title: 'Early litter walk on West Sands', category: 'environment', schedule_type: 'recurring', recurrence: 'weekly', starts: day(7, 8), duration_hours: 1.5, slots: 10, physical_level: 'light', experience: 'none', place: P.west,
    description: 'A gentle walk along West Sands picking up litter before the crowds arrive.' },
  { charity: 'food', title: 'Food bank sorting shift', category: 'food', schedule_type: 'recurring', recurrence: 'weekly', starts: day(1, 13), duration_hours: 3, slots: 6, physical_level: 'moderate', experience: 'none', place: P.market,
    description: 'Sorting donations, checking dates and packing parcels for families across Fife.' },
  { charity: 'food', title: 'Community fridge restock', category: 'food', schedule_type: 'recurring', recurrence: 'weekly', starts: day(3, 18), duration_hours: 1, slots: 2, physical_level: 'light', experience: 'none', place: P.north,
    description: 'Collect surplus food from local shops and restock the North Street community fridge.' },
  { charity: 'food', title: 'Parcel delivery by cargo bike', category: 'food', schedule_type: 'one_time', starts: day(5, 10), duration_hours: 2.5, slots: 4, physical_level: 'moderate', experience: 'some', experience_notes: 'Confident road cycling; cargo bikes provided.', place: P.market,
    description: 'Delivering food parcels by cargo bike to households around town.' },
  { charity: 'food', title: 'Christmas appeal stall', category: 'food', schedule_type: 'one_time', starts: day(12, 11), duration_hours: 4, slots: 5, physical_level: 'light', experience: 'none', place: P.market,
    description: 'Running our donation stall on Market Street and chatting to shoppers.' },
  { charity: 'companions', title: 'Afternoon tea with older neighbours', category: 'elderly', schedule_type: 'recurring', recurrence: 'weekly', starts: day(2, 14, 30), duration_hours: 2, slots: 6, physical_level: 'light', experience: 'none', place: P.kinburn,
    description: 'Serve tea, play cards and chat with older people from the area at Kinburn House.' },
  { charity: 'companions', title: 'Digital help drop-in', category: 'elderly', schedule_type: 'recurring', recurrence: 'weekly', starts: day(4, 17, 30), duration_hours: 1.5, slots: 3, physical_level: 'light', experience: 'some', experience_notes: 'Comfortable helping with phones, video calls and online forms.', place: P.north,
    description: 'Helping older people with their phones, tablets and video calls with family.' },
  { charity: 'companions', title: 'Lade Braes walking group', category: 'elderly', schedule_type: 'recurring', recurrence: 'fortnightly', starts: day(8, 10, 30), duration_hours: 1.5, slots: 4, physical_level: 'moderate', experience: 'none', place: P.lade,
    description: 'Walking at a gentle pace along the Lade Braes with a small group of older walkers.' },
  { charity: 'companions', title: 'Craigtoun family fun day helpers', category: 'kids', schedule_type: 'one_time', starts: day(13, 12), duration_hours: 4, slots: 10, physical_level: 'moderate', experience: 'experienced', experience_notes: 'PVG or previous work with children.', place: P.craigtoun,
    description: 'Running games and the craft tent at our family day in Craigtoun Park.' },
  { charity: 'reading', title: 'After-school reading buddy', category: 'kids', schedule_type: 'recurring', recurrence: 'weekly', starts: day(1, 15, 30), duration_hours: 1, slots: 6, physical_level: 'light', experience: 'some', experience_notes: 'PVG check arranged by us before your first session.', place: P.south,
    description: 'Listening to primary pupils read and talking about the story with them.' },
  { charity: 'reading', title: 'Book sale volunteers', category: 'events', schedule_type: 'one_time', starts: day(9, 10), duration_hours: 3, slots: 4, physical_level: 'moderate', experience: 'none', place: P.cathedral,
    description: 'Setting up tables, sorting donated books and running the till at our book sale.' },
  { charity: 'paws', title: 'Dog walking at the shelter', category: 'animals', schedule_type: 'recurring', recurrence: 'weekly', starts: day(2, 9), duration_hours: 1.5, slots: 5, physical_level: 'moderate', experience: 'none', place: P.harbour,
    description: 'Walking our rescue dogs along the harbour and East Sands. Leads and treats provided.' },
  { charity: 'paws', title: 'Kennel cleaning shift', category: 'animals', schedule_type: 'recurring', recurrence: 'weekly', starts: day(3, 8, 30), duration_hours: 2, slots: 3, physical_level: 'heavy', experience: 'none', place: P.harbour,
    description: 'Cleaning kennels, washing bowls and refilling water. Expect lifting and scrubbing.' },
  { charity: 'paws', title: 'Adoption day helpers', category: 'animals', schedule_type: 'one_time', starts: day(10, 11), duration_hours: 4, slots: 6, physical_level: 'light', experience: 'some', experience_notes: 'Comfortable around dogs and talking to the public.', place: P.botanic,
    description: 'Welcoming visitors and introducing them to the dogs looking for a home.' },
  { charity: 'warm', title: 'Warm space host', category: 'community', schedule_type: 'recurring', recurrence: 'weekly', starts: day(1, 17, 30), duration_hours: 2.5, slots: 4, physical_level: 'light', experience: 'none', place: P.cathedral,
    description: 'Making tea and soup and keeping visitors company in our heated hall.' },
  { charity: 'warm', title: 'Winter coat collection', category: 'community', schedule_type: 'one_time', starts: day(4, 12), duration_hours: 3, slots: 5, physical_level: 'moderate', experience: 'none', place: P.bus,
    description: 'Collecting, sorting and hanging donated winter coats for people who need one.' },
];

// Test shifts (one per test charity) so volunteers can sign up straight away.
const TEST_REQUESTS = [
  { charity: 't_charity1', title: 'Test shift A', category: 'community', schedule_type: 'one_time', starts: day(1, 14), duration_hours: 2, slots: 3, physical_level: 'light', experience: 'none', place: P.market,
    description: 'A shift for testing sign-ups, accepting and check-in.' },
  { charity: 't_charity2', title: 'Test shift B', category: 'environment', schedule_type: 'recurring', recurrence: 'weekly', starts: day(2, 10), duration_hours: 1, slots: 2, physical_level: 'moderate', experience: 'none', place: P.north,
    description: 'A weekly shift for testing recurring requests.' },
];

// Signups: [request title, volunteer key, status]. attended / no_show go through _apply_attendance
// so hours, points, badges and warnings are credited exactly as in the app.
const SIGNUPS = [
  ['Beach clean at East Sands', 'isla', 'applied'],
  ['Beach clean at East Sands', 'sofia', 'accepted'],
  ['Beach clean at East Sands', 'ewan', 'accepted'],
  ['Food bank sorting shift', 'tom', 'applied'],
  ['Food bank sorting shift', 'ewan', 'declined'],
  ['Afternoon tea with older neighbours', 'priya', 'accepted'],
  ['Afternoon tea with older neighbours', 'tom', 'cancelled'],
  ['Digital help drop-in', 'priya', 'applied'],
  ['West Sands dune planting', 'ewan', 'applied'],
  // past shifts of recurring requests (one week before the next one)
  ['Food bank sorting shift', 'isla', 'attended', -7],
  ['Afternoon tea with older neighbours', 'priya', 'attended', -7],
  ['Early litter walk on West Sands', 'sofia', 'attended', -7],
  ['Community fridge restock', 'tom', 'no_show', -7],
  ['Dog walking at the shelter', 'jamie', 'accepted'],
  ['Dog walking at the shelter', 'leo', 'applied'],
  ['After-school reading buddy', 'hannah', 'accepted'],
  ['Warm space host', 'leo', 'applied'],
  ['Warm space host', 'hannah', 'attended', -7],
  ['Dog walking at the shelter', 'jamie', 'attended', -7],
];

function check(label, { error }) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function allUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function ensureUser(existing, email, role, displayName) {
  const found = existing.find((u) => u.email === email);
  if (found) {
    await db.auth.admin.updateUserById(found.id, { user_metadata: { role, display_name: displayName } });
    return found.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role, display_name: displayName },
  });
  if (error) throw new Error(`create ${email}: ${error.message}`);
  return data.user.id;
}

async function main() {
  check('registry', await db.from('charity_registry').upsert(REGISTRY, { onConflict: 'charity_number' }));
  console.log(`registry: ${REGISTRY.length} rows`);

  const existing = await allUsers();
  const ids = {};

  const charities = [
    ...CHARITIES.map((c) => ({ ...c, email: `${c.email}@${DOMAIN}`, name: c.name + DEMO })),
    ...TEST_CHARITIES.map((c) => ({ ...c, email: `${c.email}@${TEST_DOMAIN}`, name: c.name + TEST })),
  ];
  for (const c of charities) {
    const id = await ensureUser(existing, c.email, 'charity', c.name);
    ids[c.key] = id;
    if (!c.number) {
      // Fresh charity account: no charity profile, so the app shows its set-up form.
      check(`reset ${c.name}`, await db.from('charities').delete().eq('profile_id', id));
      check(`profile ${c.name}`, await db.from('profiles').update({ verified: false, display_name: c.name }).eq('id', id));
      continue;
    }
    check(`charity ${c.name}`, await db.from('charities').upsert(
      { profile_id: id, org_name: c.name, charity_number: c.number, register: 'OSCR', verified_at: new Date().toISOString(), ...at(c.place) },
      { onConflict: 'profile_id' },
    ));
    check(`profile ${c.name}`, await db.from('profiles').update({ verified: true, display_name: c.name }).eq('id', id));
  }
  console.log(`charities: ${charities.length}`);

  const volunteers = [
    ...VOLUNTEERS.map((v) => ({ ...v, email: `${v.key}@${DOMAIN}`, name: v.name + DEMO })),
    ...TEST_VOLUNTEERS.map((v) => ({
      ...v, email: `${v.email}@${TEST_DOMAIN}`, name: v.name + TEST,
      max_km: 10, transport: 'walk', physical_max: 'heavy', experience: 'experienced', availability: ALL_TIMES, interests: [],
    })),
  ];
  for (const v of volunteers) {
    const id = await ensureUser(existing, v.email, 'volunteer', v.name);
    ids[v.key] = id;
    check(`profile ${v.name}`, await db.from('profiles').update({ verified: Boolean(v.place), display_name: v.name }).eq('id', id));
    if (!v.place) {
      check(`reset prefs ${v.name}`, await db.from('volunteer_prefs').delete().eq('profile_id', id));
      continue;
    }
    check(`prefs ${v.name}`, await db.from('volunteer_prefs').upsert(
      {
        profile_id: id, lat: v.place.lat, lng: v.place.lng, max_km: v.max_km, transport: v.transport,
        availability: v.availability, physical_max: v.physical_max, experience: v.experience, interests: v.interests,
      },
      { onConflict: 'profile_id' },
    ));
  }
  console.log(`volunteers: ${volunteers.length}`);

  const requestIds = {};
  const requestStarts = {};
  const requests = [
    ...REQUESTS.map((r) => ({ ...r, key: r.title, title: r.title + DEMO })),
    ...TEST_REQUESTS.map((r) => ({ ...r, key: r.title, title: r.title + TEST })),
  ];
  for (const r of requests) {
    const row = {
      charity_id: ids[r.charity], title: r.title, description: r.description, category: r.category,
      schedule_type: r.schedule_type, starts_at: iso(r.starts), duration_hours: r.duration_hours,
      recurrence: r.recurrence ?? null, ends_on: r.recurrence ? dateOnly(day(70, 0)) : null, slots: r.slots,
      physical_level: r.physical_level, experience: r.experience, experience_notes: r.experience_notes ?? null,
      status: 'open', ...at(r.place),
    };
    // Also finds rows seeded before titles carried the (demo) suffix.
    const { data: found, error } = await db.from('requests').select('id').eq('charity_id', row.charity_id).in('title', [r.key, r.title]).limit(1);
    if (error) throw error;
    if (found.length) {
      check(`update ${r.title}`, await db.from('requests').update(row).eq('id', found[0].id));
      requestIds[r.key] = found[0].id;
    } else {
      const { data, error: insErr } = await db.from('requests').insert(row).select('id').single();
      if (insErr) throw new Error(`insert ${r.title}: ${insErr.message}`);
      requestIds[r.key] = data.id;
    }
    requestStarts[r.key] = r.starts;
  }
  console.log(`requests: ${requests.length}`);

  let attendanceSkipped = 0;
  for (const [title, vKey, status, offsetDays = 0] of SIGNUPS) {
    const requestId = requestIds[title];
    const volunteerId = ids[vKey];
    const shift = new Date(requestStarts[title]);
    shift.setDate(shift.getDate() + offsetDays);
    const outcome = status === 'attended' || status === 'no_show';

    // Find this volunteer's signup for the same relative shift (past vs upcoming) on reruns.
    const q = db.from('signups').select('id, status').eq('request_id', requestId).eq('volunteer_id', volunteerId);
    const { data: found, error } = await (offsetDays < 0 ? q.lt('shift_at', iso(new Date())) : q.gte('shift_at', iso(new Date()))).limit(1);
    if (error) throw error;
    let signup = found[0];

    if (signup && ['attended', 'no_show'].includes(signup.status)) continue; // already final; credits stay as they are
    const initial = outcome ? 'accepted' : status;
    if (signup) {
      check(`signup ${title}/${vKey}`, await db.from('signups').update({ status: initial, shift_at: iso(shift) }).eq('id', signup.id));
    } else {
      const { data, error: insErr } = await db.from('signups')
        .insert({ request_id: requestId, volunteer_id: volunteerId, shift_at: iso(shift), status: initial })
        .select('id, status').single();
      if (insErr) throw new Error(`signup ${title}/${vKey}: ${insErr.message}`);
      signup = data;
    }
    if (outcome) {
      const { error: rpcErr } = await db.rpc('_apply_attendance', { p_signup: signup.id, p_attended: status === 'attended' });
      if (rpcErr) {
        attendanceSkipped++;
        console.warn(`attendance for ${title}/${vKey} not applied (${rpcErr.message}); left as accepted`);
      }
    }
  }
  console.log(`signups: ${SIGNUPS.length}${attendanceSkipped ? ` (${attendanceSkipped} without attendance outcome)` : ''}`);

  console.log(`\nDone. Sign in with any of these (password ${PASSWORD}):`);
  for (const c of charities) console.log(`  charity    ${c.email.padEnd(34)} ${c.name}`);
  for (const v of volunteers) console.log(`  volunteer  ${v.email.padEnd(34)} ${v.name}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
