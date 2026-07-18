-- Used by /api/auth/email-exists so login can distinguish
-- "no account" vs "wrong password" (service_role only).

CREATE OR REPLACE FUNCTION public.auth_email_exists(lookup_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = lower(trim(lookup_email))
  );
$$;

REVOKE ALL ON FUNCTION public.auth_email_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_email_exists(text) TO service_role;

COMMENT ON FUNCTION public.auth_email_exists(text) IS
  'Server-only helper for login error messaging; not granted to anon/authenticated';
