-- Enable RLS on all tables that carry company_id.
-- The my_company_id() helper (defined in 20260523040000) does the lookup.

-- ── inventory_item_category ──────────────────────────────────────────────────
alter table public.inventory_item_category enable row level security;

create policy "tenant_select" on public.inventory_item_category
  for select using (company_id = public.my_company_id());

create policy "tenant_insert" on public.inventory_item_category
  for insert with check (company_id = public.my_company_id());

create policy "tenant_update" on public.inventory_item_category
  for update using (company_id = public.my_company_id());

create policy "tenant_delete" on public.inventory_item_category
  for delete using (company_id = public.my_company_id());
