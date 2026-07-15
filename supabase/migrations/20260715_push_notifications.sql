-- Daily expense reminder preferences + Web Push subscriptions

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_time time NOT NULL DEFAULT '20:00:00';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_prompt_seen boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.notifications_enabled IS 'Daily expense reminder via Web Push';
COMMENT ON COLUMN public.profiles.notification_time IS 'Preferred reminder time (interpreted as Asia/Singapore)';
COMMENT ON COLUMN public.profiles.notifications_prompt_seen IS 'Post-onboarding notification opt-in prompt dismissed';

-- Existing onboarded users should not suddenly see the opt-in sheet
UPDATE public.profiles
SET notifications_prompt_seen = true
WHERE onboarding_complete = true;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);
