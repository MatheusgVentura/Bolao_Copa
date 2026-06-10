create unique index if not exists participants_unique_name_idx
on public.participants (lower(btrim(name)));
