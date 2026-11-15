-- 1. A volunteer can sign up again for a date they cancelled (or were declined for): only active
--    signups must be unique per request, volunteer and date.
-- 2. Check-in only counts at shift time: from 2 h before the shift starts until 2 h after it ends,
--    and only for the accepted signup inside that window (no crediting from home days early, no
--    second scan crediting next week's shift).
-- Rollback: supabase/rollback/20261115050000_resignup_checkin_window.down.sql

alter table public.signups drop constraint if exists signups_request_id_volunteer_id_shift_at_key;
create unique index if not exists signups_active_unique
  on public.signups (request_id, volunteer_id, shift_at)
  where status not in ('cancelled', 'declined');

create or replace function public.check_in(p_request uuid, p_code text)
returns public.signups language plpgsql security definer set search_path = public as $$
declare sid uuid; dur numeric;
begin
  select duration_hours into dur from public.requests where id = p_request and checkin_code = p_code;
  if not found then
    raise exception 'invalid code';
  end if;
  select id into sid from public.signups
    where request_id = p_request and volunteer_id = auth.uid() and status = 'accepted'
      and now() between shift_at - interval '2 hours' and shift_at + make_interval(secs => dur * 3600) + interval '2 hours'
    order by abs(extract(epoch from (shift_at - now()))) limit 1;
  if sid is null then
    raise exception 'Check-in opens 2 hours before your shift and closes 2 hours after it ends.';
  end if;
  return public._apply_attendance(sid, true);
end $$;
