-- Charities describe their work and may link their website (shown to volunteers).
alter table public.charities
  add column description text check (char_length(description) <= 1000),
  add column website     text check (char_length(website) <= 200 and website ~* '^https?://[^\s/?#]+\.[^\s]*$');

grant insert (description, website), update (description, website) on public.charities to authenticated;
