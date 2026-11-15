-- Undo 20261115050000_resignup_checkin_window.sql (restores the live definitions as of 2026-11-15 13:40).
-- Fails if a volunteer has since re-signed up for a cancelled date: delete those cancelled duplicates first.
drop index if exists public.signups_active_unique;
alter table public.signups add constraint signups_request_id_volunteer_id_shift_at_key unique (request_id, volunteer_id, shift_at);

create or replace function public.check_in(p_request uuid, p_code text)
returns public.signups language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not exists (select 1 from public.requests where id = p_request and checkin_code = p_code) then
    raise exception 'invalid code';
  end if;
  select id into sid from public.signups
    where request_id = p_request and volunteer_id = auth.uid() and status = 'accepted'
    order by abs(extract(epoch from (shift_at - now()))) limit 1;
  if sid is null then raise exception 'no accepted signup for this request'; end if;
  return public._apply_attendance(sid, true);
end $$;
