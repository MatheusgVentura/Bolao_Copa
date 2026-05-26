alter table public.participants add column if not exists champion_pick text check (char_length(champion_pick) <= 40);
alter table public.participants add column if not exists top_scorer_pick text check (char_length(top_scorer_pick) <= 60);
alter table public.participants add column if not exists runner_up_pick text check (char_length(runner_up_pick) <= 40);
alter table public.participants add column if not exists finalist_one_pick text check (char_length(finalist_one_pick) <= 40);
alter table public.participants add column if not exists finalist_two_pick text check (char_length(finalist_two_pick) <= 40);
alter table public.participants add column if not exists manual_bonus_points integer check (manual_bonus_points >= 0 and manual_bonus_points <= 200);

create table if not exists public.special_results (
  id boolean primary key default true,
  champion text check (char_length(champion) <= 40),
  top_scorer text check (char_length(top_scorer) <= 60),
  runner_up text check (char_length(runner_up) <= 40),
  finalist_one text check (char_length(finalist_one) <= 40),
  finalist_two text check (char_length(finalist_two) <= 40),
  bonus_active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint single_special_results_row check (id = true)
);

alter table public.special_results add column if not exists bonus_active boolean not null default false;

alter table public.predictions add column if not exists manual_points integer check (manual_points in (0, 1, 3));
alter table public.predictions add column if not exists reviewed boolean not null default false;

insert into public.special_results (id)
values (true)
on conflict (id) do nothing;

alter table public.special_results enable row level security;

drop policy if exists "Link pode editar participantes" on public.participants;
create policy "Link pode editar participantes"
on public.participants for update
to anon
using (true)
with check (true);

drop policy if exists "Link pode remover participantes" on public.participants;
create policy "Link pode remover participantes"
on public.participants for delete
to anon
using (true);

drop policy if exists "Link pode ver resultados especiais" on public.special_results;
create policy "Link pode ver resultados especiais"
on public.special_results for select
to anon
using (true);

drop policy if exists "Link pode editar resultados especiais" on public.special_results;
create policy "Link pode editar resultados especiais"
on public.special_results for update
to anon
using (true)
with check (true);

drop policy if exists "Link pode revisar palpites" on public.predictions;
create policy "Link pode revisar palpites"
on public.predictions for update
to anon
using (true)
with check (true);
