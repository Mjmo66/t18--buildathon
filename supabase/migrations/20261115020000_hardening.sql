-- Security hardening after the independent review (2026-11-15).

-- 1. Charities may only accept/decline signups on their own requests. Permissive policies are
--    OR-ed, so the old WITH CHECK (no ownership test) let a volunteer accept their own signup.
drop policy signups_charity_decide on public.signups;
create policy signups_charity_decide on public.signups for update to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and r.charity_id = auth.uid())
         and status in ('applied', 'accepted', 'declined'))
  with check (status in ('accepted', 'declined')
              and exists (select 1 from public.requests r where r.id = request_id and r.charity_id = auth.uid()));

-- Volunteers can only cancel before the shift (otherwise a no-show could be dodged afterwards).
drop policy signups_volunteer_cancel on public.signups;
create policy signups_volunteer_cancel on public.signups for update to authenticated
  using (volunteer_id = auth.uid() and status in ('applied', 'accepted') and shift_at > now())
  with check (volunteer_id = auth.uid() and status = 'cancelled');

-- Clients may only set these columns when signing up.
revoke insert on public.signups from authenticated;
grant insert (request_id, volunteer_id, shift_at) on public.signups to authenticated;

-- 2 + 3. Attendance only for accepted signups; no-show only once the shift has started;
--        shift length capped so hours cannot be inflated.
alter table public.requests add constraint duration_sane check (duration_hours <= 12);

create or replace function public._apply_attendance(p_signup uuid, p_attended boolean)
returns public.signups language plpgsql security definer set search_path = public as $$
declare s public.signups; hrs numeric; v public.profiles; shifts int;
begin
  select * into s from public.signups where id = p_signup for update;
  if s.id is null then raise exception 'signup not found'; end if;
  if s.status in ('attended', 'no_show') then return s; end if;   -- idempotent
  if s.status <> 'accepted' then raise exception 'signup is not accepted'; end if;
  if not p_attended and s.shift_at > now() then raise exception 'shift has not started'; end if;
  select duration_hours into hrs from public.requests where id = s.request_id;

  if p_attended then
    update public.signups set status = 'attended', hours_credited = hrs, marked_at = now()
      where id = p_signup returning * into s;
    update public.profiles set hours_total = hours_total + hrs, points = points + round(hrs * 10)::int
      where id = s.volunteer_id returning * into v;
    select count(*) into shifts from public.signups where volunteer_id = s.volunteer_id and status = 'attended';
    insert into public.badges (volunteer_id, code)
      select s.volunteer_id, b.code from (values
        ('first_shift', shifts >= 1),
        ('regular',     shifts >= 5),
        ('five_hours',  v.hours_total >= 5),
        ('twenty_hours', v.hours_total >= 20)
      ) as b(code, earned) where b.earned
      on conflict do nothing;
  else
    update public.signups set status = 'no_show', marked_at = now() where id = p_signup returning * into s;
    insert into public.warnings (volunteer_id, signup_id, reason) values (s.volunteer_id, s.id, 'No-show');
    update public.profiles set warnings_count = warnings_count + 1,
                               suspended = (warnings_count + 1) >= 3
      where id = s.volunteer_id;
  end if;
  return s;
end $$;
revoke all on function public._apply_attendance(uuid, boolean) from public, anon, authenticated;

-- 4. Don't expose email addresses to every signed-in user (the app reads it from the session).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'volunteer'),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end $$;
update public.profiles set email = null where email is not null;

-- 6. Conversations: the charity side must be a charity; messages: server sets id and time.
drop policy conversations_create on public.conversations;
create policy conversations_create on public.conversations for insert to authenticated
  with check (auth.uid() in (charity_id, volunteer_id)
              and exists (select 1 from public.charities c where c.profile_id = charity_id)
              and exists (select 1 from public.profiles p where p.id = volunteer_id and p.role = 'volunteer'));
revoke insert on public.messages from authenticated;
grant insert (conversation_id, sender_id, ciphertext, nonce) on public.messages to authenticated;
revoke insert on public.conversations from authenticated;
grant insert (request_id, charity_id, volunteer_id) on public.conversations to authenticated;
