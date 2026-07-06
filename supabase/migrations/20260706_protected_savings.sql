-- Protected savings — monthly savings goal + home prompt dismiss flag
-- Safe to re-run. See supabase/schema.sql for documentation.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_savings_goal numeric NOT NULL DEFAULT 0
    CHECK (monthly_savings_goal >= 0);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS savings_goal_prompt_dismissed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.monthly_savings_goal IS
  'Monthly amount reserved before safe-to-spend; 0 = disabled (legacy behavior)';

COMMENT ON COLUMN public.profiles.savings_goal_prompt_dismissed IS
  'Home savings prompt dismissed permanently; also set true when user sets a goal';
