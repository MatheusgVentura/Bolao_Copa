update public.predictions
set manual_points = null,
    reviewed = false
where manual_points is not null;

alter table public.predictions
drop constraint if exists predictions_manual_points_check;

alter table public.predictions
add constraint predictions_manual_points_check
check (manual_points in (0, 1, 3));
