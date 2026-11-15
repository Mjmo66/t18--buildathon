-- A charity can correct its charity number after sign-up. The column stays closed to direct
-- updates: this function normalises the number, derives the register from its format, clears the
-- old verification (it belonged to the old number) and checks the new number against the registry.
-- Returns true when the new number is verified.
create or replace function public.update_charity_number(p_number text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_number   text := upper(regexp_replace(coalesce(p_number, ''), '\s', '', 'g'));
  v_register text;
  v_current  text;
  v_ok       boolean;
begin
  select charity_number into v_current from public.charities where profile_id = auth.uid();
  if not found then
    raise exception 'No charity profile for this account.' using errcode = 'P0002';
  end if;

  v_register := case
    when v_number ~ '^SC[0-9]{6}$'  then 'OSCR'
    when v_number ~ '^NIC[0-9]{6}$' then 'CCNI'
    when v_number ~ '^[0-9]{6,7}$'  then 'CCEW'
  end;
  if v_register is null then
    raise exception 'Charity number format not recognised (e.g. SC012345, 1234567 or NIC100002).'
      using errcode = '22023';
  end if;

  if v_number = v_current then
    return exists (select 1 from public.charities where profile_id = auth.uid() and verified_at is not null);
  end if;

  if exists (select 1 from public.charities where charity_number = v_number and profile_id <> auth.uid()) then
    raise exception 'This charity number is already registered.' using errcode = '23505';
  end if;

  update public.charities
     set charity_number = v_number, register = v_register, verified_at = null
   where profile_id = auth.uid();
  update public.profiles set verified = false where id = auth.uid();

  select public.verify_charity() into v_ok;
  return v_ok;
end $$;

revoke execute on function public.update_charity_number(text) from public, anon;
grant execute on function public.update_charity_number(text) to authenticated;
