-- Ensure circle invite codes are always stored lowercase for consistent joins

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  ELSE
    NEW.invite_code := lower(trim(NEW.invite_code));
  END IF;
  RETURN NEW;
END;
$$;

-- Normalize any existing codes that may have mixed case
UPDATE public.circles
SET invite_code = lower(trim(invite_code))
WHERE invite_code IS DISTINCT FROM lower(trim(invite_code));
