-- Dream Manager v2: target + date + month-end progress ledger
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_target_amount numeric
    CHECK (goal_target_amount IS NULL OR goal_target_amount >= 0),
  ADD COLUMN IF NOT EXISTS goal_target_date date,
  ADD COLUMN IF NOT EXISTS goal_saved_amount numeric NOT NULL DEFAULT 0
    CHECK (goal_saved_amount >= 0),
  ADD COLUMN IF NOT EXISTS goal_progress_through_month text,
  ADD COLUMN IF NOT EXISTS goal_started_at date;

COMMENT ON COLUMN public.profiles.goal_target_amount IS
  'Optional total dream target (e.g. 1700 for Bali trip); pairs with goal_target_date';
COMMENT ON COLUMN public.profiles.goal_target_date IS
  'Optional deadline for the dream; used for on-track math and hero copy';
COMMENT ON COLUMN public.profiles.goal_saved_amount IS
  'Running total from finalized protected months';
COMMENT ON COLUMN public.profiles.goal_progress_through_month IS
  'YYYY-MM last calendar month finalized into goal_saved_amount';
COMMENT ON COLUMN public.profiles.goal_started_at IS
  'First calendar month dream savings tracking applies';
