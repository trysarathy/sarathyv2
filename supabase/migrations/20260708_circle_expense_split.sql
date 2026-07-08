-- Circle expense split: link opt-in budget claims to a split moment (idempotent per user)
ALTER TABLE public.budget_entries
  ADD COLUMN IF NOT EXISTS source_circle_moment_id uuid
    REFERENCES public.circle_moments (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS budget_entries_user_moment_claim_idx
  ON public.budget_entries (user_id, source_circle_moment_id)
  WHERE source_circle_moment_id IS NOT NULL;

COMMENT ON COLUMN public.budget_entries.source_circle_moment_id IS
  'Set when user taps Add my share on a circle split; prevents double-claim';
