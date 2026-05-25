alter table public.participants
add column if not exists manual_bonus_points integer
check (manual_bonus_points >= 0 and manual_bonus_points <= 200);

drop policy if exists "Link pode editar participantes" on public.participants;
create policy "Link pode editar participantes"
on public.participants for update
to anon
using (true)
with check (true);
