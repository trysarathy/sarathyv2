-- Finverse bank linking — run in Supabase SQL editor (safe to re-run)
-- See supabase/schema.sql for full documentation.

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

-- No RLS policies: server routes use SUPABASE_SERVICE_ROLE_KEY only.
