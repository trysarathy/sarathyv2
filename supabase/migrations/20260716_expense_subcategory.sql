-- Expense subcategories (student-specific detail under main category)

ALTER TABLE public.budget_entries
  ADD COLUMN IF NOT EXISTS subcategory text;

COMMENT ON COLUMN public.budget_entries.subcategory IS
  'Optional detail under category (e.g. Food → Hawker)';
