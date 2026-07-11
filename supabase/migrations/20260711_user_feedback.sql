-- Early product feedback after active use
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  rating text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_feedback_user_id_idx
  ON public.user_feedback (user_id);

CREATE INDEX IF NOT EXISTS user_feedback_created_at_idx
  ON public.user_feedback (created_at DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own feedback" ON public.user_feedback;
CREATE POLICY "Users insert own feedback"
  ON public.user_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own feedback" ON public.user_feedback;
CREATE POLICY "Users read own feedback"
  ON public.user_feedback FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_feedback IS
  'In-app feedback prompt ratings (Love it / Getting there / Confused)';
