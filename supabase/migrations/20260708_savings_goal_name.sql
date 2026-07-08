-- Optional user label for protected monthly savings (e.g. "Bali fund")
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_name text;

COMMENT ON COLUMN public.profiles.goal_name IS
  'Optional name for monthly_savings_goal; shown on home hero and in Sarathy context';
