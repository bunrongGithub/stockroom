-- ═══════════════════════════════════════════════════════════════════════════
-- Modules catalog sync — canonical navigation catalog as of 2026-07-07
--
-- The `modules` table is application CONFIG data (navigation, routing,
-- component registry keys, action buttons). It was curated by hand for
-- months while the 20260603 seed kept an obsolete catalog, so fresh
-- environments booted with broken navigation. This migration converges ANY
-- environment to the current catalog:
--   1. upsert every catalog row (parents resolved by PATH, never by id)
--   2. prune rows whose path is not in the catalog (obsolete seed leftovers;
--      role_module_permission rows cascade)
--   3. re-grant seed-role permissions over the final catalog
-- Idempotent: re-running is a no-op. On the live DB this is a no-op by
-- construction (the catalog below IS the live catalog).
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS _catalog;
CREATE TEMP TABLE _catalog (
    key TEXT, label TEXT, path TEXT, component TEXT, type TEXT,
    icon TEXT, sort_order INT, parent_path TEXT, is_active BOOLEAN, is_initial_data BOOLEAN
);

INSERT INTO _catalog (key, label, path, component, type, icon, sort_order, parent_path, is_active, is_initial_data) VALUES
    ('/dashboard', 'Dashboard', '/dashboard', 'DashboardHome', 'transaction', 'LayoutDashboard', 0, NULL, true, false),
    ('/finances', 'Finance', '/finances', 'RootPage', 'transaction', 'HandCoins', 3, NULL, true, false),
    ('/inventory', 'Inventory', '/inventory', 'InventoryDashboard', 'transaction', 'Package', 2, NULL, true, false),
    ('sales', 'Sale', '/sale', 'SaleOrder', 'transaction', 'BadgePercent', 2, NULL, true, false),
    ('setting', 'Setting', '/setting', 'Setting', 'transaction', 'Settings', 4, NULL, true, false),
    ('/finances/invoice', 'Invoice', '/finances/invoice', 'SaleInvoice', 'transaction', NULL, 1, '/finances', true, false),
    ('/finances/payment', 'Payment', '/finances/payment', 'SalePayment', 'transaction', NULL, 2, '/finances', true, false),
    ('/inventory/receipts', 'Receipt', '/inventory/receipts', 'Receipt', 'transaction', 'Package', 1, '/inventory', true, true),
    ('/inventory/stock_adjust', 'Stock Adjustment', '/inventory/stock_adjust', 'InventoryStockAdjModule', 'transaction', 'ArrowLeftRight', 2, '/inventory', true, false),
    ('/sale/delivery-note', 'Delivery Note', '/sale/delivery-note', 'SaleDeliveryNote', 'transaction', 'ShoppingBagIcon', 2, '/sale', true, false),
    ('/sale/order', 'Order', '/sale/order', 'SaleOrder', 'transaction', NULL, 1, '/sale', true, false),
    ('/setting/company', 'Company', '/setting/company', 'Company', 'transaction', 'Building2', 1, '/setting', true, true),
    ('/setting/module', 'Module', '/setting/module', 'Module', 'transaction', NULL, 4, '/setting', true, true),
    ('/setting/role', 'Role', '/setting/role', 'Role', 'transaction', 'UserCheck', 2, '/setting', true, true),
    ('/setting/users', 'User', '/setting/users', 'User', 'transaction', 'User', 1, '/setting', true, true),
    ('/finances/invoice/create', 'Create', '/finances/invoice/create', 'SaleInvoiceCreate', 'action', NULL, 1, '/finances/invoice', true, false),
    ('/finances/payment/create', 'Create', '/finances/payment/create', 'SalePaymentCreate', 'action', NULL, 1, '/finances/payment', true, false),
    ('/inventory/configurations/category', 'Category', '/inventory/configurations/category', 'InventoryCategoryModule', 'configuration', 'LayoutGrid', 2, '/inventory', true, true),
    ('/inventory/configurations/stock-item', 'Stock', '/inventory/configurations/stock-item', 'InventoryStockItemsModule', 'configuration', 'Box', 1, '/inventory', true, true),
    ('/inventory/configurations/uom', 'UOM', '/inventory/configurations/uom', 'Uom', 'configuration', 'Weight', 3, '/inventory', true, true),
    ('/inventory/configurations/warehouse', 'Warehouse', '/inventory/configurations/warehouse', 'Warehouse', 'configuration', 'Warehouse', 4, '/inventory', true, true),
    ('/inventory/receipts/create', 'Create', '/inventory/receipts/create', 'ReceiptCreate', 'action', 'Plus', 1, '/inventory/receipts', true, false),
    ('/inventory/stock_adjust/create', 'Create', '/inventory/stock_adjust/create', 'InventoryStockAdjCreate', 'action', NULL, 1, '/inventory/stock_adjust', true, false),
    ('/sale/delivery-note/create', 'Create', '/sale/delivery-note/create', 'SaleDeliveryNoteCreate', 'action', 'Plus', 1, '/sale/delivery-note', true, false),
    ('/sale/order/create', 'Create', '/sale/order/create', 'SaleOrderCreate', 'action', 'Plus', 3, '/sale/order', true, false),
    ('/setting/module/create', 'Create', '/setting/module/create', 'ModuleCreate', 'action', 'Plus', 1, '/setting/module', true, false),
    ('/api/setting/role', 'Create', '/setting/role/create', 'RoleCreate', 'action', 'Plus', 2, '/setting/role', true, false),
    ('/finances/invoice/:id/print', 'Print', '/finances/invoice/:id/print', 'SaleInvoicePrint', 'action', NULL, 4, '/finances/invoice', true, false),
    ('/finances/invoice/:id/update', 'Update', '/finances/invoice/:id/update', 'SaleInvoiceUpdate', 'action', NULL, 3, '/finances/invoice', true, false),
    ('/finances/invoice/:id/view', 'View', '/finances/invoice/:id/view', 'SaleInvoiceDetail', 'action', NULL, 2, '/finances/invoice', true, false),
    ('/finances/payment/:id/update', 'Update', '/finances/payment/:id/update', 'SalePaymentUpdate', 'action', 'Edit2Icon', 3, '/finances/payment', true, false),
    ('/finances/payment/:id/view', 'View', '/finances/payment/:id/view', 'SalePaymentDetail', 'action', NULL, 2, '/finances/payment', true, false),
    ('/inventory/configurations/category/create', 'Create', '/inventory/configurations/category/create', 'CategoryFormCreate', 'action', 'Plus', 1, '/inventory/configurations/category', true, false),
    ('/inventory/configurations/stock-item/create', 'Create', '/inventory/configurations/stock-item/create', 'InventoryStockItemCreate', 'action', 'Plus', 1, '/inventory/configurations/stock-item', true, false),
    ('/inventory/configurations/uom/create', 'Create', '/inventory/configurations/uom/create', 'InventoryUomCreate', 'action', 'Plus', 1, '/inventory/configurations/uom', true, false),
    ('/inventory/configurations/warehouse/create', 'Create', '/inventory/configurations/warehouse/create', 'WarehouseCreate', 'action', 'Plus', 1, '/inventory/configurations/warehouse', true, false),
    ('/inventory/receipts/:id/update', 'Update', '/inventory/receipts/:id/update', 'ReceiptUpdate', 'action', 'Edit', 3, '/inventory/receipts', true, false),
    ('/inventory/receipts/:id/view', 'View', '/inventory/receipts/:id/view', 'ReceiptView', 'action', 'Eye', 2, '/inventory/receipts', true, true),
    ('/inventory/stock_adjust/:id/update', 'Update', '/inventory/stock_adjust/:id/update', 'InventoryStockAdjUpdate', 'action', NULL, 3, '/inventory/stock_adjust', true, false),
    ('/inventory/stock_adjust/:id/view', 'View', '/inventory/stock_adjust/:id/view', 'InventoryStockAdjDetail', 'action', NULL, 2, '/inventory/stock_adjust', true, false),
    ('/sale/delivery-note/:id/update', 'Update', '/sale/delivery-note/:id/update', 'SaleDeliveryNoteUpdate', 'action', 'ShoppingBagIcon', 3, '/sale/delivery-note', true, false),
    ('/sale/delivery-note/:id/view', 'View', '/sale/delivery-note/:id/view', 'SaleDeliveryNoteDetail', 'action', 'Eye', 2, '/sale/delivery-note', true, false),
    ('/sale/order/:id/update', 'Update', '/sale/order/:id/update', 'SaleOrderUpdate', 'action', 'BadgePercent', 3, '/sale/order', true, false),
    ('/sale/order/:id/view', 'View', '/sale/order/:id/view', 'SaleOrderDetail', 'action', 'Eye', 2, '/sale/order', true, false),
    ('/setting/module/:id/delete', 'Delete', '/setting/module/:id/delete', 'PopUpDeleteTransactionModal', 'action', 'Trash', 3, '/setting/module', true, false),
    ('/setting/module/:id/update', 'Update', '/setting/module/:id/update', 'ModuleUpdate', 'action', NULL, 3, '/setting/module', true, false),
    ('/setting/module/[id]/view', 'View', '/setting/module/[id]/view', 'ModuleDetail', 'action', NULL, 2, '/setting/module', true, false),
    ('/api/setting/role/:id', 'View', '/setting/role/:id/view', 'Get', 'action', 'Eye', 1, '/setting/role', true, false),
    ('/api/setting/role/:id/update', 'Update', '/api/setting/role/:id/update', 'RoleUpdate', 'action', 'ShoppingBagIcon', 2, '/setting/role', true, false),
    ('/inventory/configurations/stock-item/:id/update', 'Update', '/inventory/configurations/stock-item/:id/update', 'InventoryStockItemUpdate', 'action', 'Edit', 3, '/inventory/configurations/stock-item', true, false),
    ('/inventory/configurations/stock-item/:id/view', 'View', '/inventory/configurations/stock-item/:id/view', 'InventoryStockItemView', 'action', 'Eye', 2, '/inventory/configurations/stock-item', true, false),
    ('/inventory/configurations/uom/:id/update', 'Update', '/inventory/configurations/uom/:id/update', 'InventoryUomUpdate', 'action', 'Edit2Icon', 2, '/inventory/configurations/uom', true, false),
    ('/inventory/configurations/warehouse/:id/update', 'Update', '/inventory/configurations/warehouse/:id/update', 'WarehouseUpdate', 'action', 'Edit2Icon', 2, '/inventory/configurations/warehouse', true, false);

-- 1. Prune obsolete rows first (frees unique keys reused by the new catalog),
--    then dedupe rows sharing a path (the pre-2026-06 seed had two rows on
--    '/inventory'); keep the oldest row per path.
DELETE FROM public.modules WHERE path NOT IN (SELECT path FROM _catalog);
DELETE FROM public.modules m
USING public.modules d
WHERE m.path = d.path AND m.id > d.id;

-- 2. Insert missing rows, parents first (3 passes cover max depth)
DO $$
DECLARE pass INT;
BEGIN
  FOR pass IN 1..4 LOOP
    INSERT INTO public.modules (key, label, path, component, type, icon, sort_order, parent_id, is_active, is_initial_data)
    SELECT c.key, c.label, c.path, c.component, c.type, c.icon, c.sort_order,
           p.id, c.is_active, c.is_initial_data
    FROM _catalog c
    LEFT JOIN public.modules p ON p.path = c.parent_path
    WHERE NOT EXISTS (SELECT 1 FROM public.modules m WHERE m.path = c.path)
      AND (c.parent_path IS NULL OR p.id IS NOT NULL);
  END LOOP;
END $$;

-- 3. Converge existing rows to catalog values (parent by path)
UPDATE public.modules m
SET key = c.key, label = c.label, component = c.component, type = c.type,
    icon = c.icon, sort_order = c.sort_order, is_active = c.is_active,
    is_initial_data = c.is_initial_data,
    parent_id = (SELECT p.id FROM public.modules p WHERE p.path = c.parent_path)
FROM _catalog c
WHERE m.path = c.path
  AND (m.key, m.label, m.component, m.type, coalesce(m.icon,''), m.sort_order,
       m.is_active, m.is_initial_data, coalesce(m.parent_id, -1))
      IS DISTINCT FROM
      (c.key, c.label, c.component, c.type, coalesce(c.icon,''), c.sort_order,
       c.is_active, c.is_initial_data,
       coalesce((SELECT p.id FROM public.modules p WHERE p.path = c.parent_path), -1));

-- 4. Seed-role permission grants over the final catalog (fresh envs only;
--    existing grants untouched)
INSERT INTO public.role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT r.id, m.id, true, true, true, true, true
FROM public.roles r, public.modules m WHERE r.name IN ('super_admin', 'admin')
ON CONFLICT (role_id, module_id) DO NOTHING;

INSERT INTO public.role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT r.id, m.id, true, true, true, false, true
FROM public.roles r, public.modules m WHERE r.name = 'staff'
ON CONFLICT (role_id, module_id) DO NOTHING;

INSERT INTO public.role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT r.id, m.id, true, false, false, false, false
FROM public.roles r, public.modules m WHERE r.name = 'member'
ON CONFLICT (role_id, module_id) DO NOTHING;

DROP TABLE IF EXISTS _catalog;
