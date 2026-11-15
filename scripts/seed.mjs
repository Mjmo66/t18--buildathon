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

const P = {
  market: { name: 'Market Street', lat: 56.3402, lng: -2.7955 },
  north: { name: 'North Street', lat: 56.3411, lng: -2.7942 },
  east: { name: 'East Sands', lat: 56.3376, lng: -2.7826 },
  west: { name: 'West Sands', lat: 56.3497, lng: -2.8104 },
  harbour: { name: 'Harbour', lat: 56.3392, lng: -2.7858 },
  kinburn: { name: 'Kinburn Park', lat: 56.3387, lng: -2.8018 },
  lade: { name: 'Lade Braes', lat: 56.3365, lng: -2.8045 },
  craigtoun: { name: 'Craigtoun Park', lat: 56.3197, lng: -2.8415 },
};
const at = (p) => ({ address: `${p.name}, St Andrews`, lat: p.lat, lng: p.lng });

// Demo registry. The first three belong to seeded charities; the rest are free for live sign-ups.
const REGISTRY = [
  { charity_number: 'SC900101', org_name: 'East Neuk Beach Guardians', register: 'OSCR' },
  { charity_number: 'SC900102', org_name: 'Fife Food Share Network', register: 'OSCR' },
  { charity_number: 'SC900103', org_name: 'Kinburn Companions', register: 'OSCR' },
  { charity_number: 'SC900104', org_name: 'Lade Braes Wildlife Trust', register: 'OSCR' },
  { charity_number: 'SC900105', org_name: 'St Andrews Reading Buddies', register: 'OSCR' },
  { charity_number: 'SC900106', org_name: 'Craigtoun Green Spaces', register: 'OSCR' },
  { charity_number: 'SC900107', org_name: 'Harbour Paws Rescue', register: 'OSCR' },
  { charity_number: 'SC900108', org_name: 'Kingdom Warm Spaces', register: 'OSCR' },
];

const CHARITIES = [
  { key: 'beach', email: 'beachguardians', name: 'East Neuk Beach Guardians', number: 'SC900101', place: P.harbour },
  { key: 'food', email: 'foodshare', name: 'Fife Food Share Network', number: 'SC900102', place: P.market },
  { key: 'companions', email: 'companions', name: 'Kinburn Companions', number: 'SC900103', place: P.kinburn },
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
];

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
  if (found) return found.id;
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

  for (const c of CHARITIES) {
    const id = await ensureUser(existing, `${c.email}@${DOMAIN}`, 'charity', c.name);
    ids[c.key] = id;
    check(`charity ${c.name}`, await db.from('charities').upsert(
      { profile_id: id, org_name: c.name, charity_number: c.number, register: 'OSCR', verified_at: new Date().toISOString(), ...at(c.place) },
      { onConflict: 'profile_id' },
    ));
    check(`profile ${c.name}`, await db.from('profiles').update({ verified: true, display_name: c.name }).eq('id', id));
  }
  console.log(`charities: ${CHARITIES.length}`);

  for (const v of VOLUNTEERS) {
    const id = await ensureUser(existing, `${v.key}@${DOMAIN}`, 'volunteer', v.name);
    ids[v.key] = id;
    check(`profile ${v.name}`, await db.from('profiles').update({ verified: true, display_name: v.name }).eq('id', id));
    check(`prefs ${v.name}`, await db.from('volunteer_prefs').upsert(
      {
        profile_id: id, lat: v.place.lat, lng: v.place.lng, max_km: v.max_km, transport: v.transport,
        availability: v.availability, physical_max: v.physical_max, experience: v.experience, interests: v.interests,
      },
      { onConflict: 'profile_id' },
    ));
  }
  console.log(`volunteers: ${VOLUNTEERS.length}`);

  const requestIds = {};
  const requestStarts = {};
  for (const r of REQUESTS) {
    const row = {
      charity_id: ids[r.charity], title: r.title, description: r.description, category: r.category,
      schedule_type: r.schedule_type, starts_at: iso(r.starts), duration_hours: r.duration_hours,
      recurrence: r.recurrence ?? null, ends_on: r.recurrence ? dateOnly(day(70, 0)) : null, slots: r.slots,
      physical_level: r.physical_level, experience: r.experience, experience_notes: r.experience_notes ?? null,
      status: 'open', ...at(r.place),
    };
    const { data: found, error } = await db.from('requests').select('id').eq('charity_id', row.charity_id).eq('title', r.title).limit(1);
    if (error) throw error;
    if (found.length) {
      check(`update ${r.title}`, await db.from('requests').update(row).eq('id', found[0].id));
      requestIds[r.title] = found[0].id;
    } else {
      const { data, error: insErr } = await db.from('requests').insert(row).select('id').single();
      if (insErr) throw new Error(`insert ${r.title}: ${insErr.message}`);
      requestIds[r.title] = data.id;
    }
    requestStarts[r.title] = r.starts;
  }
  console.log(`requests: ${REQUESTS.length}`);

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
  for (const c of CHARITIES) console.log(`  charity    ${c.email}@${DOMAIN}`);
  for (const v of VOLUNTEERS) console.log(`  volunteer  ${v.key}@${DOMAIN}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
