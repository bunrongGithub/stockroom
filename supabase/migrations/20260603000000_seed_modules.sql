-- ─────────────────────────────────────────────────────────────────────────────
-- Module catalog seed — inventory system
-- ─────────────────────────────────────────────────────────────────────────────

-- Level 0: top-level modules
insert into public.modules (key, label, path, component, parent_id, icon, sort_order, is_active) values
  ('inventory', 'Inventory', '/inventory', 'InventoryRootModule', null, 'Box', 1, true),
  ('sales',     'Sales',     '/sales',     'SalesRootModule',     null, 'BadgePercent', 2, true)
on conflict (key) do nothing;

-- Level 1: inventory children (parent = inventory module)
insert into public.modules (key, label, path, component, parent_id, icon, sort_order, is_active)
select
  sub.key, sub.label, sub.path, sub.component, m.id, sub.icon, sub.sort_order, true
from public.modules m
cross join (values
  ('inventory/items',         'Items',         '/inventory',               'InventoryItemsModule',    'Package',    1),
  ('inventory/branch',        'Branch',        '/inventory/branch',         'InventoryBranchModule',   'Warehouse',  2),
  ('inventory/stock-adjust',  'Stock Adjust',  '/inventory/stock_adjust',   'InventoryStockAdjModule', 'ArrowLeftRight', 3),
  ('inventory/config',        'Configuration', '/inventory/configurations', 'InventoryConfigModule',   'Settings',   4)
) as sub(key, label, path, component, icon, sort_order)
where m.key = 'inventory'
on conflict (key) do nothing;

-- Level 2: inventory/config children (parent = inventory/config)
insert into public.modules (key, label, path, component, parent_id, icon, sort_order, is_active)
select
  sub.key, sub.label, sub.path, sub.component, m.id, sub.icon, sub.sort_order, true
from public.modules m
cross join (values
  ('inventory/config/category', 'Category', '/inventory/configurations/category', 'InventoryCategoryModule', 'Tag',   1),
  ('inventory/config/uom',      'UOM',      '/inventory/configurations/uom',      'InventoryUomModule',      'Ruler', 2),
  ('inventory/config/brand',    'Brand',    '/inventory/configurations/brand',    'InventoryBrandModule',    'Award', 3)
) as sub(key, label, path, component, icon, sort_order)
where m.key = 'inventory/config'
on conflict (key) do nothing;


-- ─────────────────────────────────────────────────────────────────────────────
-- Role-module permissions seed
-- Grant admin full access, staff view+create+update, member view-only
-- ─────────────────────────────────────────────────────────────────────────────

-- super_admin: full access to all modules
insert into public.role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
select r.id, m.id, true, true, true, true, true
from public.roles r, public.modules m
where r.name = 'super_admin'
on conflict (role_id, module_id) do nothing;

-- admin: full access to all modules
insert into public.role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
select r.id, m.id, true, true, true, true, true
from public.roles r, public.modules m
where r.name = 'admin'
on conflict (role_id, module_id) do nothing;

-- staff: view + create + update, no delete, can export
insert into public.role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
select r.id, m.id, true, true, true, false, true
from public.roles r, public.modules m
where r.name = 'staff'
on conflict (role_id, module_id) do nothing;

-- member: view only
insert into public.role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
select r.id, m.id, true, false, false, false, false
from public.roles r, public.modules m
where r.name = 'member'
on conflict (role_id, module_id) do nothing;
