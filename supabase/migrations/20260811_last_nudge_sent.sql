-- Pre-spend nudge: at most one budget warning push per day
alter table profiles
add column if not exists last_nudge_sent date;

comment on column public.profiles.last_nudge_sent is
  'SGT calendar date of last budget warning nudge (max one per day)';
