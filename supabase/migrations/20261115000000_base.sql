-- Base schema for the volunteering app (hackathon, St Andrews).
-- Owned by the coordinator. Feature agents add NEW migration files; they never edit this one.

create type public.user_role as enum ('charity', 'volunteer');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created by trigger from user metadata)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  role           public.user_role not null,
  display_name   text not null,
  email          text,
  verified       boolean not null default false,
  public_key     text,                         -- base64 NaCl box public key (E2E chat)
  warnings_count int not null default 0,
  suspended      boolean not null default false,
  hours_total    numeric not null default 0,
  points         int not null default 0,
  created_at     timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, display_name, email)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'volunteer'),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Charities
-- ---------------------------------------------------------------------------
create table public.charities (
  profile_id     uuid primary key references public.profiles (id) on delete cascade,
  org_name       text not null,
  charity_number text not null unique,         -- normalised: upper case, no spaces
  register       text not null check (register in ('OSCR', 'CCEW', 'CCNI')),
  verified_at    timestamptz,
  address        text,
  lat            double precision,
  lng            double precision
);

-- Demo lookup table standing in for the OSCR / Charity Commission registers.
create table public.charity_registry (
  charity_number text primary key,
  org_name       text not null,
  register       text not null check (register in ('OSCR', 'CCEW', 'CCNI'))
);

-- ---------------------------------------------------------------------------
-- Volunteer preferences (User Space)
-- ---------------------------------------------------------------------------
create table public.volunteer_prefs (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  lat           double precision,
  lng           double precision,
  max_km        numeric not null default 2,
  transport     text not null default 'walk' check (transport in ('walk', 'bike', 'bus', 'car')),
  -- {"mon": ["morning","afternoon","evening"], "tue": [...], ...}
  availability  jsonb not null default '{}'::jsonb,
  physical_max  text not null default 'moderate' check (physical_max in ('light', 'moderate', 'heavy')),
  experience    text not null default 'none' check (experience in ('none', 'some', 'experienced')),
  interests     text[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- Requests (volunteer opportunities)
-- ---------------------------------------------------------------------------
create table public.requests (
  id               uuid primary key default gen_random_uuid(),
  charity_id       uuid not null references public.charities (profile_id) on delete cascade,
  title            text not null,
  description      text not null default '',
  category         text,                       -- e.g. 'environment', 'food', 'elderly', 'kids', 'animals'
  schedule_type    text not null check (schedule_type in ('one_time', 'recurring')),
  starts_at        timestamptz not null,       -- first (or only) shift start
  duration_hours   numeric not null check (duration_hours > 0),
  recurrence       text check (recurrence in ('weekly', 'fortnightly', 'monthly')),
  ends_on          date,                       -- last date for recurring requests
  slots            int not null default 1 check (slots > 0),
  physical_level   text not null default 'light' check (physical_level in ('light', 'moderate', 'heavy')),
  experience       text not null default 'none' check (experience in ('none', 'some', 'experienced')),
  experience_notes text,
  address          text,
  lat              double precision,
  lng              double precision,
  status           text not null default 'open' check (status in ('open', 'filled', 'closed')),
  checkin_code     text not null default replace(gen_random_uuid()::text, '-', ''),  -- shown as QR by the charity
  created_at       timestamptz not null default now(),
  check ((schedule_type = 'one_time' and recurrence is null) or (schedule_type = 'recurring' and recurrence is not null))
);

-- ---------------------------------------------------------------------------
-- Signups and accountability
-- ---------------------------------------------------------------------------
create table public.signups (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.requests (id) on delete cascade,
  volunteer_id   uuid not null references public.profiles (id) on delete cascade,
  shift_at       timestamptz not null,
  status         text not null default 'applied'
                 check (status in ('applied', 'accepted', 'declined', 'cancelled', 'attended', 'no_show')),
  hours_credited numeric,
  marked_at      timestamptz,
  created_at     timestamptz not null default now(),
  unique (request_id, volunteer_id, shift_at)
);

create table public.warnings (
  id           uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  signup_id    uuid references public.signups (id) on delete set null,
  reason       text not null,
  created_at   timestamptz not null default now()
);

create table public.badges (
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  code         text not null,                  -- 'first_shift', 'five_hours', 'twenty_hours', 'regular'
  earned_at    timestamptz not null default now(),
  primary key (volunteer_id, code)
);

-- ---------------------------------------------------------------------------
-- E2E chat: the server only ever stores ciphertext
-- ---------------------------------------------------------------------------
create table public.conversations (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid references public.requests (id) on delete set null,
  charity_id   uuid not null references public.profiles (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique nulls not distinct (request_id, charity_id, volunteer_id)
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  ciphertext      text not null,               -- base64
  nonce           text not null,               -- base64
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Passkeys (service role only; used by the `passkey` edge function)
-- ---------------------------------------------------------------------------
create table public.passkey_credentials (
  id          text primary key,                -- credential id, base64url
  user_id     uuid not null references auth.users (id) on delete cascade,
  public_key  text not null,                   -- base64url COSE key
  counter     bigint not null default 0,
  transports  text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table public.passkey_challenges (
  id         uuid primary key default gen_random_uuid(),
  challenge  text not null,
  kind       text not null check (kind in ('register', 'login')),
  user_id    uuid references auth.users (id) on delete cascade,
  pending    jsonb,                            -- {email, display_name, role} for a new account
  expires_at timestamptz not null default now() + interval '5 minutes'
);

-- ---------------------------------------------------------------------------
-- Row level security and column grants
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.charities           enable row level security;
alter table public.charity_registry    enable row level security;
alter table public.volunteer_prefs     enable row level security;
alter table public.requests            enable row level security;
alter table public.signups             enable row level security;
alter table public.warnings            enable row level security;
alter table public.badges              enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.passkey_credentials enable row level security;
alter table public.passkey_challenges  enable row level security;

revoke all on all tables in schema public from anon;
revoke all on public.passkey_credentials, public.passkey_challenges from authenticated;

-- profiles: everyone signed in can read (names, public keys, badges); users edit only safe columns
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, public_key) on public.profiles to authenticated;

-- charities
create policy charities_read on public.charities for select to authenticated using (true);
create policy charities_insert_own on public.charities for insert to authenticated
  with check (profile_id = auth.uid()
              and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'charity'));
create policy charities_update_own on public.charities for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
revoke insert, update, delete on public.charities from authenticated;
grant insert (profile_id, org_name, charity_number, register, address, lat, lng) on public.charities to authenticated;
grant update (org_name, address, lat, lng) on public.charities to authenticated;

create policy registry_read on public.charity_registry for select to authenticated using (true);
revoke insert, update, delete on public.charity_registry from authenticated;

-- volunteer prefs: own row only
create policy prefs_own on public.volunteer_prefs for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- requests: everyone reads; only the owning, verified charity writes
create policy requests_read on public.requests for select to authenticated using (true);
create policy requests_insert on public.requests for insert to authenticated
  with check (charity_id = auth.uid()
              and exists (select 1 from public.charities c where c.profile_id = auth.uid() and c.verified_at is not null));
create policy requests_update on public.requests for update to authenticated
  using (charity_id = auth.uid()) with check (charity_id = auth.uid());
create policy requests_delete on public.requests for delete to authenticated using (charity_id = auth.uid());

-- signups
create policy signups_read on public.signups for select to authenticated
  using (volunteer_id = auth.uid()
         or exists (select 1 from public.requests r where r.id = request_id and r.charity_id = auth.uid()));
create policy signups_insert on public.signups for insert to authenticated
  with check (volunteer_id = auth.uid() and status = 'applied'
              and exists (select 1 from public.profiles p
                          where p.id = auth.uid() and p.role = 'volunteer' and not p.suspended)
              and exists (select 1 from public.requests r where r.id = request_id and r.status = 'open'));
create policy signups_volunteer_cancel on public.signups for update to authenticated
  using (volunteer_id = auth.uid() and status in ('applied', 'accepted'))
  with check (volunteer_id = auth.uid() and status = 'cancelled');
create policy signups_charity_decide on public.signups for update to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and r.charity_id = auth.uid())
         and status in ('applied', 'accepted', 'declined'))
  with check (status in ('accepted', 'declined'));
revoke update, delete on public.signups from authenticated;
grant update (status) on public.signups to authenticated;

-- warnings and badges: written only by mark_attendance
create policy warnings_read on public.warnings for select to authenticated
  using (volunteer_id = auth.uid()
         or exists (select 1 from public.signups s join public.requests r on r.id = s.request_id
                    where s.id = signup_id and r.charity_id = auth.uid()));
create policy badges_read on public.badges for select to authenticated using (true);
revoke insert, update, delete on public.warnings, public.badges from authenticated;

-- conversations and messages: members only
create policy conversations_member on public.conversations for select to authenticated
  using (auth.uid() in (charity_id, volunteer_id));
create policy conversations_create on public.conversations for insert to authenticated
  with check (auth.uid() in (charity_id, volunteer_id));
revoke update, delete on public.conversations from authenticated;

create policy messages_read on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and auth.uid() in (c.charity_id, c.volunteer_id)));
create policy messages_send on public.messages for insert to authenticated
  with check (sender_id = auth.uid()
              and exists (select 1 from public.conversations c
                          where c.id = conversation_id and auth.uid() in (c.charity_id, c.volunteer_id)));
revoke update, delete on public.messages from authenticated;

-- ---------------------------------------------------------------------------
-- Functions (RPC)
-- ---------------------------------------------------------------------------

-- Verify the caller's charity against the demo registry (stands in for OSCR / CCEW lookup).
create or replace function public.verify_charity()
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select exists (
    select 1 from public.charities c join public.charity_registry g on g.charity_number = c.charity_number
    where c.profile_id = auth.uid()
  ) into ok;
  if ok then
    update public.charities set verified_at = now() where profile_id = auth.uid();
    update public.profiles set verified = true where id = auth.uid();
  end if;
  return ok;
end $$;

-- Demo stand-in for volunteer identity verification.
create or replace function public.demo_verify_volunteer()
returns void language sql security definer set search_path = public as $$
  update public.profiles set verified = true where id = auth.uid() and role = 'volunteer';
$$;

-- Internal: apply attendance outcome, credit hours/points/badges or issue a warning.
create or replace function public._apply_attendance(p_signup uuid, p_attended boolean)
returns public.signups language plpgsql security definer set search_path = public as $$
declare s public.signups; hrs numeric; v public.profiles; shifts int;
begin
  select * into s from public.signups where id = p_signup for update;
  if s.status in ('attended', 'no_show') then return s; end if;   -- idempotent
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

-- Charity marks a signup attended / no-show.
create or replace function public.mark_attendance(p_signup uuid, p_attended boolean)
returns public.signups language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.signups s join public.requests r on r.id = s.request_id
                 where s.id = p_signup and r.charity_id = auth.uid()) then
    raise exception 'not your request';
  end if;
  return public._apply_attendance(p_signup, p_attended);
end $$;

-- Volunteer scans the charity's QR code (payload: request id + checkin_code).
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

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.signups;
