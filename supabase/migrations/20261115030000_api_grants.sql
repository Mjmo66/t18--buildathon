-- New Supabase projects no longer grant table access to the API roles by default.
-- Grant exactly what the RLS policies expect; column grants from earlier migrations stay.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Reads (RLS decides which rows). Passkey tables stay closed.
grant select on all tables in schema public to authenticated;
revoke all on public.passkey_credentials, public.passkey_challenges from authenticated;

-- Writes not covered by earlier column grants.
grant select, insert, update, delete on public.volunteer_prefs to authenticated;
grant insert, update, delete on public.requests to authenticated;

-- RPCs callable by signed-in users (each checks the caller itself).
grant execute on function public.verify_charity() to authenticated;
grant execute on function public.demo_verify_volunteer() to authenticated;
grant execute on function public.mark_attendance(uuid, boolean) to authenticated;
grant execute on function public.check_in(uuid, text) to authenticated;
grant execute on function public.sweep_no_shows(uuid) to authenticated;
revoke execute on function public._apply_attendance(uuid, boolean) from public, anon, authenticated;
