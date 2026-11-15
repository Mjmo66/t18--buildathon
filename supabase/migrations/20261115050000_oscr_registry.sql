-- Real Scottish Charity Register (OSCR) in charity_registry, loaded by scripts/import-oscr.mjs.
-- Verification now also needs the organisation name to match the register entry, so a mistyped
-- or borrowed number does not verify an unrelated name. (It does not prove the person represents
-- the charity: register entries are public.)

alter table public.charity_registry
  add column known_as    text,
  add column status      text,          -- OSCR: 'Active', 'Not Submitted', 'Not Monitored'
  add column website     text,
  add column activities  text,          -- "What the charity is set up to do and how it does this"
  add column source      text not null default 'demo' check (source in ('demo', 'oscr')),
  add column imported_at timestamptz;

-- Words of an organisation name without case, punctuation and legal filler ("The X Trust SCIO" → {x, trust}).
create or replace function public.charity_name_words(t text)
returns text[] language sql immutable set search_path = public as $$
  select coalesce(array_agg(distinct w), '{}')
  from regexp_split_to_table(
         regexp_replace(replace(lower(coalesce(t, '')), '&', ' and '), '[^a-z0-9]+', ' ', 'g'), ' ') as w
  where w <> '' and w not in ('the', 'and', 'of', 'for', 'ltd', 'limited', 'scio', 'cio', 'inc', 'co', 'company', 'plc');
$$;

-- True when at least half of the longer name's words appear in the other name.
-- Mirrors namesMatch() in src/components/charityNumber.js (instant feedback in the form).
create or replace function public.charity_names_match(a text, b text)
returns boolean language sql immutable set search_path = public as $$
  with x as (select public.charity_name_words(a) as wa, public.charity_name_words(b) as wb)
  select cardinality(wa) > 0 and cardinality(wb) > 0
     and (select count(*) from (select unnest(wa) intersect select unnest(wb)) s)::numeric
         / greatest(cardinality(wa), cardinality(wb)) >= 0.5
  from x;
$$;

create or replace function public.verify_charity()
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select exists (
    select 1 from public.charities c join public.charity_registry g on g.charity_number = c.charity_number
    where c.profile_id = auth.uid()
      and (public.charity_names_match(c.org_name, g.org_name) or public.charity_names_match(c.org_name, g.known_as))
  ) into ok;
  if ok then
    update public.charities set verified_at = coalesce(verified_at, now()) where profile_id = auth.uid();
    update public.profiles set verified = true where id = auth.uid();
  end if;
  return ok;
end $$;

-- A verified charity that renames itself to something the register does not know loses the badge.
create or replace function public.charities_recheck_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.org_name is distinct from old.org_name and new.verified_at is not null and not exists (
    select 1 from public.charity_registry g
    where g.charity_number = new.charity_number
      and (public.charity_names_match(new.org_name, g.org_name) or public.charity_names_match(new.org_name, g.known_as))
  ) then
    new.verified_at := null;
    update public.profiles set verified = false where id = new.profile_id;
  end if;
  return new;
end $$;

create trigger charities_recheck_name before update of org_name on public.charities
  for each row execute function public.charities_recheck_name();

revoke all on function public.charities_recheck_name() from public, anon, authenticated;
grant execute on function public.charity_name_words(text), public.charity_names_match(text, text) to authenticated;
