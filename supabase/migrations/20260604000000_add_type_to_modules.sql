-- Add module type to control where each module appears in the UI.
--   transaction   → left sidebar
--   configuration → top navbar tabs
--   action        → no navigation (create / update / delete / view / export pages)

alter table public.modules
  add column if not exists type varchar(20) not null default 'transaction'
  check (type in ('transaction', 'configuration', 'action'));

-- Config sub-modules (Category, UOM, Brand) belong to the top navbar
update public.modules
set type = 'configuration'
where key in (
  'inventory/config/category',
  'inventory/config/uom',
  'inventory/config/brand'
);

-- Action routes: any path segment that ends in /create, /update/…, /delete/…
update public.modules
set type = 'action'
where
  path like '%/create'
  or path ~ '/update(/[^/]+)?$'
  or path ~ '/delete(/[^/]+)?$'
  or path ~ '/view(/[^/]+)?$'
  or path ~ '/export(/[^/]+)?$';
