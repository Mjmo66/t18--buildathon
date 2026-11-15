-- Demo charity registry (fictional names, OSCR-style numbers). Runs on `supabase db reset`.
-- Demo accounts, requests and signups are created by `npm run seed` (scripts/seed.mjs), which
-- needs the auth admin API. Keep this list in sync with REGISTRY in that script.
insert into public.charity_registry (charity_number, org_name, register) values
  ('SC900101', 'East Neuk Beach Guardians (demo)', 'OSCR'),
  ('SC900102', 'Fife Food Share Network (demo)', 'OSCR'),
  ('SC900103', 'Kinburn Companions (demo)', 'OSCR'),
  ('SC900104', 'Lade Braes Wildlife Trust (demo)', 'OSCR'),
  ('SC900105', 'St Andrews Reading Buddies (demo)', 'OSCR'),
  ('SC900106', 'Craigtoun Green Spaces (demo)', 'OSCR'),
  ('SC900107', 'Harbour Paws Rescue (demo)', 'OSCR'),
  ('SC900108', 'Kingdom Warm Spaces (demo)', 'OSCR'),
  ('SC900109', 'Test Charity 1 (test)', 'OSCR'),
  ('SC900110', 'Test Charity 2 (test)', 'OSCR'),
  ('SC900111', 'Test Charity 3 (test)', 'OSCR'),
  ('SC900112', 'Test Charity 4 (test)', 'OSCR')
on conflict (charity_number) do update set org_name = excluded.org_name, register = excluded.register;
