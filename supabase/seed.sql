-- Demo charity registry (fictional names, OSCR-style numbers). Runs on `supabase db reset`.
-- Demo accounts, requests and signups are created by `npm run seed` (scripts/seed.mjs), which
-- needs the auth admin API. Keep this list in sync with REGISTRY in that script.
insert into public.charity_registry (charity_number, org_name, register) values
  ('SC900101', 'East Neuk Beach Guardians', 'OSCR'),
  ('SC900102', 'Fife Food Share Network', 'OSCR'),
  ('SC900103', 'Kinburn Companions', 'OSCR'),
  ('SC900104', 'Lade Braes Wildlife Trust', 'OSCR'),
  ('SC900105', 'St Andrews Reading Buddies', 'OSCR'),
  ('SC900106', 'Craigtoun Green Spaces', 'OSCR'),
  ('SC900107', 'Harbour Paws Rescue', 'OSCR'),
  ('SC900108', 'Kingdom Warm Spaces', 'OSCR')
on conflict (charity_number) do update set org_name = excluded.org_name, register = excluded.register;
