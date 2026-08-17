-- Per-user merchant → category memory for share / receipt logging
create table if not exists public.merchant_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  merchant text not null,
  merchant_normalized text not null,
  category text not null,
  subcategory text,
  times_seen integer not null default 1 check (times_seen >= 0),
  times_corrected integer not null default 0 check (times_corrected >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_normalized)
);

create index if not exists merchant_memory_user_id_idx
  on public.merchant_memory (user_id);

comment on table public.merchant_memory is
  'Learned merchant→category mappings from share/receipt logging';

alter table public.merchant_memory enable row level security;

drop policy if exists merchant_memory_select_own on public.merchant_memory;
create policy merchant_memory_select_own on public.merchant_memory
  for select using (auth.uid() = user_id);

drop policy if exists merchant_memory_insert_own on public.merchant_memory;
create policy merchant_memory_insert_own on public.merchant_memory
  for insert with check (auth.uid() = user_id);

drop policy if exists merchant_memory_update_own on public.merchant_memory;
create policy merchant_memory_update_own on public.merchant_memory
  for update using (auth.uid() = user_id);

drop policy if exists merchant_memory_delete_own on public.merchant_memory;
create policy merchant_memory_delete_own on public.merchant_memory
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.merchant_memory to authenticated;
grant select, insert, update, delete on public.merchant_memory to service_role;
