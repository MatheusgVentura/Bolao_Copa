alter table public.matches
add column if not exists predictions_released boolean not null default false;
