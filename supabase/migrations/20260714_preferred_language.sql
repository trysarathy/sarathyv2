-- Preferred companion language for Sarathy AI responses.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';

COMMENT ON COLUMN public.profiles.preferred_language IS
  'Companion reply language: en | pt-BR | hi | zh | vi | tl';

-- Backfill from legacy language_preference when present.
UPDATE public.profiles
SET preferred_language = CASE
  WHEN language_preference IN ('en', 'pt-BR', 'hi', 'zh', 'vi', 'tl') THEN language_preference
  WHEN language_preference IN ('pt', 'pt_BR') THEN 'pt-BR'
  WHEN language_preference IN ('zh-CN', 'zh-Hans') THEN 'zh'
  WHEN language_preference = 'fil' THEN 'tl'
  ELSE preferred_language
END
WHERE language_preference IS NOT NULL;
