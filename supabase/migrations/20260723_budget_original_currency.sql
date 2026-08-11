-- BDT / multi-currency expense originals
alter table budget_entries
add column if not exists original_amount numeric;

alter table budget_entries
add column if not exists original_currency text;

comment on column public.budget_entries.original_amount is
  'Pre-conversion amount when logged in a foreign currency';
comment on column public.budget_entries.original_currency is
  'ISO currency code for original_amount (e.g. BDT)';
