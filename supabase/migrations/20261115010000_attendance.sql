-- Attendance: no-show sweep and automatic filled/open status for one-time requests.
-- Builds on public._apply_attendance from 20261115000000_base.sql.

-- ---------------------------------------------------------------------------
-- (a) A charity sweeps its one-time requests: signups still 'accepted' more than 24 h after the
--     shift ended become no-shows (warning, suspension at 3). Recurring requests are left alone
--     because a series signup may not carry a real per-shift time.
--     p_request null = all of the caller's requests. Returns the number of signups marked.
-- ---------------------------------------------------------------------------
create or replace function public.sweep_no_shows(p_request uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare sid uuid; n int := 0;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_request is not null and not exists (
    select 1 from public.requests where id = p_request and charity_id = auth.uid()
  ) then
    raise exception 'not your request';
  end if;

  for sid in
    select s.id
      from public.signups s
      join public.requests r on r.id = s.request_id
     where r.charity_id = auth.uid()
       and (p_request is null or r.id = p_request)
       and r.schedule_type = 'one_time'
       and s.status = 'accepted'
       and s.shift_at + r.duration_hours::double precision * interval '1 hour' + interval '24 hours' < now()
  loop
    perform public._apply_attendance(sid, false);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.sweep_no_shows(uuid) from public, anon;
grant execute on function public.sweep_no_shows(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- (b) One-time requests: status 'filled' once taken places (accepted, attended or no-show)
--     reach slots, back to 'open' when below. 'closed' is never touched; recurring requests keep
--     their manual status (slots there are per shift).
-- ---------------------------------------------------------------------------
create or replace function public._fill_status(p_request uuid, p_slots int, p_status text)
returns text language sql stable security definer set search_path = public as $$
  select case
           when p_status = 'closed' then p_status
           when (select count(*) from public.signups s
                  where s.request_id = p_request
                    and s.status in ('accepted', 'attended', 'no_show')) >= p_slots then 'filled'
           else 'open'
         end;
$$;
revoke all on function public._fill_status(uuid, int, text) from public, anon, authenticated;

-- Signup inserted, deleted or its status changed: recompute the request's status.
create or replace function public._signups_sync_fill()
returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid; r public.requests; want text;
begin
  if tg_op = 'DELETE' then rid := old.request_id; else rid := new.request_id; end if;
  select * into r from public.requests where id = rid for update;
  if found and r.schedule_type = 'one_time' then
    want := public._fill_status(r.id, r.slots, r.status);
    if want is distinct from r.status then
      update public.requests set status = want where id = r.id;
    end if;
  end if;
  return null;   -- AFTER trigger
end $$;
revoke all on function public._signups_sync_fill() from public, anon, authenticated;

create trigger signups_sync_fill
  after insert or delete or update of status on public.signups
  for each row execute function public._signups_sync_fill();

-- Charity changes slots or status (e.g. reopens a closed request): keep 'filled' / 'open' right.
create or replace function public._requests_sync_fill()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.schedule_type = 'one_time' then
    new.status := public._fill_status(new.id, new.slots, new.status);
  end if;
  return new;
end $$;
revoke all on function public._requests_sync_fill() from public, anon, authenticated;

create trigger requests_sync_fill
  before update of slots, status, schedule_type on public.requests
  for each row execute function public._requests_sync_fill();
