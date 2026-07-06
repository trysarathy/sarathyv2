-- Companion Context Engine — daily brief cache + conversation memory summary
-- Safe to re-run. See supabase/schema.sql for documentation.
--
-- Server-only tables: no RLS policies for authenticated users.
-- All reads/writes via SUPABASE_SERVICE_ROLE_KEY in API routes.

-- -----------------------------------------------------------------------------
-- daily_briefs
-- One Groq-generated greeting paragraph per user per calendar day (Asia/Singapore).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  brief_date date NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, brief_date)
);

COMMENT ON TABLE public.daily_briefs IS 'Cached daily home brief; one row per user per day; server-only via service role';

CREATE INDEX IF NOT EXISTS daily_briefs_user_date_idx
  ON public.daily_briefs (user_id, brief_date DESC);

ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- conversation_summaries
-- Compressed memory of chat_messages older than the last 20 verbatim turns.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  summarized_through timestamptz,
  message_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.conversation_summaries IS 'Rolling LLM summary of older Sarathy chat; server-only via service role';

ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- No RLS policies on either table — same pattern as finverse_connections.
