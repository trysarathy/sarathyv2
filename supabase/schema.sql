-- =============================================================================
-- Sarathy — Supabase schema reference
-- =============================================================================
-- Canonical documentation of the database shape expected by the application.
-- Keep this file in sync when adding tables/columns in the Supabase SQL editor.
--
-- Apply to a fresh project: run sections in order (extensions → tables → indexes
-- → triggers → RLS). Existing projects: use individual ALTER statements instead
-- of CREATE TABLE when tables already exist.
--
-- Last updated: 2026-07-08 (dream target + progress ledger on profiles)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- profiles
-- One row per auth.users record (created by handle_new_user trigger below).
-- Referenced by: home, onboarding, profile, sarathy, check, insights, etc.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text,
  home_country text,
  current_country text,
  user_types text[] NOT NULL DEFAULT '{}',
  primary_currency text NOT NULL DEFAULT 'SGD',
  secondary_currency text,
  language_preference text,
  preferred_language text NOT NULL DEFAULT 'en',
  planning_amount numeric,
  total_money numeric,
  money_type text,
  responsible_for text,
  money_fear text,
  income_timing text,
  companion_vibe text NOT NULL DEFAULT 'calm_mentor'
    CHECK (companion_vibe IN ('calm_mentor', 'hype_friend', 'no_nonsense_sibling')),
  daily_login_streak integer NOT NULL DEFAULT 0,
  last_login_date date,
  total_xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  achievements text[] NOT NULL DEFAULT '{}',
  onboarding_complete boolean NOT NULL DEFAULT false,
  colour_theme text NOT NULL DEFAULT 'saffron',
  quiet_mode_until timestamptz,
  monthly_savings_goal numeric NOT NULL DEFAULT 0 CHECK (monthly_savings_goal >= 0),
  savings_goal_prompt_dismissed boolean NOT NULL DEFAULT false,
  goal_name text,
  goal_target_amount numeric CHECK (goal_target_amount IS NULL OR goal_target_amount >= 0),
  goal_target_date date,
  goal_saved_amount numeric NOT NULL DEFAULT 0 CHECK (goal_saved_amount >= 0),
  goal_progress_through_month text,
  goal_started_at date,
  notifications_enabled boolean NOT NULL DEFAULT false,
  notification_time time NOT NULL DEFAULT '20:00:00',
  notifications_prompt_seen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profile and onboarding preferences; id matches auth.users.id';
COMMENT ON COLUMN public.profiles.secondary_currency IS 'Used by future/page.tsx for INR home-cost comparisons';
COMMENT ON COLUMN public.profiles.preferred_language IS 'Companion reply language: en | pt-BR | hi | zh | vi | tl';
COMMENT ON COLUMN public.profiles.notifications_enabled IS 'Daily expense reminder via Web Push';
COMMENT ON COLUMN public.profiles.notification_time IS 'Preferred reminder time (interpreted as Asia/Singapore)';
COMMENT ON COLUMN public.profiles.notifications_prompt_seen IS 'Post-onboarding notification opt-in prompt dismissed';
COMMENT ON COLUMN public.profiles.monthly_savings_goal IS 'Monthly amount reserved before safe-to-spend; 0 = disabled';
COMMENT ON COLUMN public.profiles.savings_goal_prompt_dismissed IS 'Home savings prompt dismissed; also true when user sets a goal';
COMMENT ON COLUMN public.profiles.goal_name IS 'Optional name for monthly_savings_goal (e.g. Bali fund)';
COMMENT ON COLUMN public.profiles.goal_target_amount IS 'Optional total dream target';
COMMENT ON COLUMN public.profiles.goal_target_date IS 'Optional dream deadline';
COMMENT ON COLUMN public.profiles.goal_saved_amount IS 'Running total from finalized protected months';
COMMENT ON COLUMN public.profiles.goal_progress_through_month IS 'YYYY-MM last month finalized into goal_saved_amount';
COMMENT ON COLUMN public.profiles.goal_started_at IS 'First month dream savings tracking applies';

-- -----------------------------------------------------------------------------
-- budget_entries
-- Expense log (manual, statement upload, receipt, Wise sync).
-- logged_via values used in app: manual | statement | receipt | wise | finverse | circle_split
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.budget_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  category text NOT NULL,
  subcategory text,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  logged_via text NOT NULL DEFAULT 'manual',
  original_amount numeric,
  original_currency text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.budget_entries IS 'All user expenses; amount is stored in profile primary_currency after FX conversion when applicable';
COMMENT ON COLUMN public.budget_entries.logged_via IS 'Source: manual, statement, receipt, wise, finverse, circle_split';
COMMENT ON COLUMN public.budget_entries.original_amount IS 'Pre-conversion amount when logged in a foreign currency (LogExpenseSheet)';
COMMENT ON COLUMN public.budget_entries.original_currency IS 'ISO currency code for original_amount';
COMMENT ON COLUMN public.budget_entries.source_circle_moment_id IS
  'Set when user taps Add my share on a circle split; prevents double-claim';

CREATE INDEX IF NOT EXISTS budget_entries_user_id_idx ON public.budget_entries (user_id);
CREATE INDEX IF NOT EXISTS budget_entries_user_entry_date_idx ON public.budget_entries (user_id, entry_date DESC);

-- -----------------------------------------------------------------------------
-- fixed_spending
-- Recurring bills (rent, subscriptions). Used in safe-to-spend calculation.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fixed_spending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '💳',
  amount numeric NOT NULL CHECK (amount >= 0),
  frequency text NOT NULL DEFAULT 'monthly',
  due_day integer CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fixed_spending_user_id_idx ON public.fixed_spending (user_id);

-- -----------------------------------------------------------------------------
-- goals
-- User savings goals (created during onboarding and Story page).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🎯',
  target_amount numeric NOT NULL DEFAULT 0,
  current_amount numeric NOT NULL DEFAULT 0,
  deadline date,
  user_caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user_id_idx ON public.goals (user_id);

-- -----------------------------------------------------------------------------
-- mood_logs
-- Daily mood check-in. One row per user per day (upsert on user_id + entry_date).
-- Mood values used in app: good | anxious | stressed
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mood_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  mood text NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

CREATE INDEX IF NOT EXISTS mood_logs_user_id_idx ON public.mood_logs (user_id);

-- -----------------------------------------------------------------------------
-- user_feedback
-- In-app feedback after ~3 minutes of active use.
-- Ratings used in app: "Love it" | "Getting there" | "Confused"
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  rating text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_feedback_user_id_idx ON public.user_feedback (user_id);
CREATE INDEX IF NOT EXISTS user_feedback_created_at_idx ON public.user_feedback (created_at DESC);

-- -----------------------------------------------------------------------------
-- chat_messages
-- Sarathy AI companion conversation history.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_user_id_created_at_idx
  ON public.chat_messages (user_id, created_at);

-- -----------------------------------------------------------------------------
-- circles
-- Private money communities. invite_code is 8-char lowercase (DB-generated).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circles_invite_code_idx ON public.circles (invite_code);

-- -----------------------------------------------------------------------------
-- circle_members
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.circle_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  display_name text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS circle_members_user_id_idx ON public.circle_members (user_id);

-- -----------------------------------------------------------------------------
-- circle_moments
-- Shared activity feed inside a circle (streak, check-in, goal, win, expense_split).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.circle_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  reactions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circle_moments_circle_id_idx
  ON public.circle_moments (circle_id, created_at);

-- -----------------------------------------------------------------------------
-- remittance_logs
-- User-logged SGD → INR transfers (Remittance page).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.remittance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount_sent numeric NOT NULL CHECK (amount_sent > 0),
  from_currency text NOT NULL DEFAULT 'SGD',
  to_currency text NOT NULL DEFAULT 'INR',
  rate_used numeric NOT NULL,
  provider text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS remittance_logs_user_id_idx
  ON public.remittance_logs (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- finverse_connections
-- Bank link tokens from Finverse Data API. Server-only access via service role.
-- refresh_token must never be readable by the browser (no RLS SELECT for users).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finverse_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  login_identity_id text NOT NULL,
  institution_name text,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  linked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.finverse_connections IS 'Finverse bank link credentials; read/write via SUPABASE_SERVICE_ROLE_KEY only';

CREATE INDEX IF NOT EXISTS finverse_connections_user_id_idx
  ON public.finverse_connections (user_id);

-- -----------------------------------------------------------------------------
-- daily_briefs
-- Cached Groq-generated home greeting — one paragraph per user per day.
-- Server-only access (SUPABASE_SERVICE_ROLE_KEY). Do not expose to client SELECT.
-- Mood may inform tone in generation but must not be named explicitly in copy.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  brief_date date NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, brief_date)
);

COMMENT ON TABLE public.daily_briefs IS 'Daily home brief cache; server-only via service role';

CREATE INDEX IF NOT EXISTS daily_briefs_user_date_idx
  ON public.daily_briefs (user_id, brief_date DESC);

-- -----------------------------------------------------------------------------
-- conversation_summaries
-- Rolling summary of chat_messages older than the last 20 verbatim turns.
-- Server-only access (SUPABASE_SERVICE_ROLE_KEY).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  summarized_through timestamptz,
  message_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.conversation_summaries IS 'Compressed Sarathy chat memory; server-only via service role';

-- -----------------------------------------------------------------------------
-- waitlist
-- Pre-launch signup form (public insert, no auth required).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  user_type text,
  country_from text,
  country_now text DEFAULT 'Singapore',
  sends_money_home boolean DEFAULT false,
  money_stress text,
  current_tool text,
  biggest_pain text,
  feature_excited text,
  wants_beta boolean DEFAULT false,
  referral text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_email_idx ON public.waitlist (email);

-- -----------------------------------------------------------------------------
-- vanguard_users
-- Not referenced by Sarathy application code in this repository.
-- Documented here because the table exists in the shared Supabase project.
-- Reconcile column list against the live DB if this section drifts.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vanguard_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  cohort text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vanguard_users IS 'External/beta cohort list — verify columns in Supabase dashboard; not used by Sarathy app routes';

-- -----------------------------------------------------------------------------
-- money_allocations (types only — table reserved, no app usage yet)
-- Defined in types/index.ts for future onboarding money split feature.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.money_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '💰',
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Helper functions & triggers
-- =============================================================================

-- Auto-generate 8-character invite codes for new circles
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  ELSE
    -- Always store lowercase so join lookups match consistently
    NEW.invite_code := lower(trim(NEW.invite_code));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circles_set_invite_code ON public.circles;
CREATE TRIGGER circles_set_invite_code
  BEFORE INSERT ON public.circles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_invite_code();

-- Create profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
-- Policies are not fully enumerated here — enable RLS and ensure authenticated
-- users can read/write their own rows (user_id = auth.uid() or id = auth.uid()).
-- waitlist typically allows anonymous INSERT only.
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_spending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finverse_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- finverse_connections, daily_briefs, conversation_summaries:
-- no policies for authenticated users. Server routes use SUPABASE_SERVICE_ROLE_KEY.

-- Example policies (adjust to match your live Supabase project):

-- CREATE POLICY "Users manage own profile"
--   ON public.profiles FOR ALL
--   USING (auth.uid() = id)
--   WITH CHECK (auth.uid() = id);

-- CREATE POLICY "Users manage own budget entries"
--   ON public.budget_entries FOR ALL
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- Incremental migrations (safe to re-run on existing databases)
-- =============================================================================

ALTER TABLE public.budget_entries ADD COLUMN IF NOT EXISTS logged_via text NOT NULL DEFAULT 'manual';
ALTER TABLE public.budget_entries ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.budget_entries ADD COLUMN IF NOT EXISTS original_amount numeric;
ALTER TABLE public.budget_entries ADD COLUMN IF NOT EXISTS original_currency text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS secondary_currency text;

-- Finverse bank linking (2026-07-05)
CREATE TABLE IF NOT EXISTS public.finverse_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  login_identity_id text NOT NULL,
  institution_name text,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  linked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finverse_connections_user_id_idx
  ON public.finverse_connections (user_id);

ALTER TABLE public.finverse_connections ENABLE ROW LEVEL SECURITY;

-- Companion context (2026-07-06)
CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  brief_date date NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, brief_date)
);

CREATE INDEX IF NOT EXISTS daily_briefs_user_date_idx
  ON public.daily_briefs (user_id, brief_date DESC);

ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  summarized_through timestamptz,
  message_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Protected savings (2026-07-06)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_savings_goal numeric NOT NULL DEFAULT 0
  CHECK (monthly_savings_goal >= 0);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS savings_goal_prompt_dismissed boolean NOT NULL DEFAULT false;

-- Named savings goal (2026-07-08)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_name text;

-- Dream target + progress ledger (2026-07-08)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_target_amount numeric
  CHECK (goal_target_amount IS NULL OR goal_target_amount >= 0);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_target_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_saved_amount numeric NOT NULL DEFAULT 0
  CHECK (goal_saved_amount >= 0);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_progress_through_month text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_started_at date;

-- Circle expense split claims (2026-07-08)
ALTER TABLE public.budget_entries ADD COLUMN IF NOT EXISTS source_circle_moment_id uuid
  REFERENCES public.circle_moments (id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS budget_entries_user_moment_claim_idx
  ON public.budget_entries (user_id, source_circle_moment_id)
  WHERE source_circle_moment_id IS NOT NULL;

-- User feedback prompt (2026-07-11)
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  rating text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_feedback_user_id_idx ON public.user_feedback (user_id);
CREATE INDEX IF NOT EXISTS user_feedback_created_at_idx ON public.user_feedback (created_at DESC);
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Web Push daily reminders (2026-07-15)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_time time NOT NULL DEFAULT '20:00:00';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications_prompt_seen boolean NOT NULL DEFAULT false;

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

-- Expense subcategories (2026-07-16)
ALTER TABLE public.budget_entries ADD COLUMN IF NOT EXISTS subcategory text;
COMMENT ON COLUMN public.budget_entries.subcategory IS
  'Optional detail under category (e.g. Food → Hawker)';
