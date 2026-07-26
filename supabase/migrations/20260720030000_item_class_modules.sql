-- ── Item class modules: Non-Stock + Service ─────────────────────────────────
-- The item master splits into three classes: stock / non_stock / service.
-- Stock has module rows (catalog sync); the non-stock components existed in
-- code but were never seeded, and service is new. Seed both so the whole
-- hierarchy is reachable, keep the three classes adjacent in the config tab,
-- and mirror the stock-item sibling's role permissions.

-- ── 1. Non-Stock Items: /inventory/configurations/non-stock-item ────────────
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/configurations/non-stock-item', 'Non-Stock', '/inventory/configurations/non-stock-item',
       'NoneStockForm',
       (SELECT id FROM modules WHERE path = '/inventory'),
       'configuration', 'PackageOpen', 2, true
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/configurations/non-stock-item');

INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/configurations/non-stock-item/create', 'Create', '/inventory/configurations/non-stock-item/create',
       'InventoryNonStockCreate',
       (SELECT id FROM modules WHERE path = '/inventory/configurations/non-stock-item'), 'action', 'Plus', 1, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/configurations/non-stock-item/create');

INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/configurations/non-stock-item/:id/view', 'View', '/inventory/configurations/non-stock-item/:id/view',
       'InventoryNonStockView',
       (SELECT id FROM modules WHERE path = '/inventory/configurations/non-stock-item'), 'action', 'Eye', 2, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/configurations/non-stock-item/:id/view');

INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/configurations/non-stock-item/:id/update', 'Update', '/inventory/configurations/non-stock-item/:id/update',
       'InventoryNonStockUpdate',
       (SELECT id FROM modules WHERE path = '/inventory/configurations/non-stock-item'), 'action', 'Edit', 3, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/configurations/non-stock-item/:id/update');

-- ── 2. Service Items: /inventory/configurations/service-item ────────────────
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/configurations/service-item', 'Service', '/inventory/configurations/service-item',
       'InventoryServiceItemModule',
       (SELECT id FROM modules WHERE path = '/inventory'),
       'configuration', 'Wrench', 3, true
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/configurations/service-item');

INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/configurations/service-item/create', 'Create', '/inventory/configurations/service-item/create',
       'InventoryServiceItemCreate',
       (SELECT id FROM modules WHERE path = '/inventory/configurations/service-item'), 'action', 'Plus', 1, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/configurations/service-item/create');

INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/configurations/service-item/:id/view', 'View', '/inventory/configurations/service-item/:id/view',
       'InventoryServiceItemView',
       (SELECT id FROM modules WHERE path = '/inventory/configurations/service-item'), 'action', 'Eye', 2, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/configurations/service-item/:id/view');

INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/configurations/service-item/:id/update', 'Update', '/inventory/configurations/service-item/:id/update',
       'InventoryServiceItemUpdate',
       (SELECT id FROM modules WHERE path = '/inventory/configurations/service-item'), 'action', 'Edit', 3, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/configurations/service-item/:id/update');

-- ── 3. Keep the three item classes adjacent in the config tab ───────────────
-- Stock=1, Non-Stock=2, Service=3; shift the other config siblings down.
UPDATE modules SET sort_order = 4 WHERE path = '/inventory/configurations/category';
UPDATE modules SET sort_order = 5 WHERE path = '/inventory/configurations/uom';
UPDATE modules SET sort_order = 6 WHERE path = '/inventory/configurations/warehouse';

-- ── 4. Permissions: mirror the stock-item sibling onto all eight rows ───────
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/inventory/configurations/stock-item'
JOIN modules dst ON dst.path IN (
    '/inventory/configurations/non-stock-item',
    '/inventory/configurations/non-stock-item/create',
    '/inventory/configurations/non-stock-item/:id/view',
    '/inventory/configurations/non-stock-item/:id/update',
    '/inventory/configurations/service-item',
    '/inventory/configurations/service-item/create',
    '/inventory/configurations/service-item/:id/view',
    '/inventory/configurations/service-item/:id/update')
ON CONFLICT (role_id, module_id) DO NOTHING;

-- ── 5. Action grants: runtime authz reads role_module_action_permission ─────
-- get_user_modules (since 20260720010000) derives can_* flags from per-action
-- grants, not role_module_permission. Mirror each stock-item row's grants onto
-- the corresponding non-stock-item / service-item row.
INSERT INTO role_module_action_permission (role_id, module_id, company_id, action, granted)
SELECT ap.role_id, dst.id, ap.company_id, ap.action, ap.granted
FROM role_module_action_permission ap
JOIN modules src ON src.id = ap.module_id
JOIN (VALUES
    ('/inventory/configurations/stock-item',            '/inventory/configurations/non-stock-item'),
    ('/inventory/configurations/stock-item/create',     '/inventory/configurations/non-stock-item/create'),
    ('/inventory/configurations/stock-item/:id/view',   '/inventory/configurations/non-stock-item/:id/view'),
    ('/inventory/configurations/stock-item/:id/update', '/inventory/configurations/non-stock-item/:id/update'),
    ('/inventory/configurations/stock-item',            '/inventory/configurations/service-item'),
    ('/inventory/configurations/stock-item/create',     '/inventory/configurations/service-item/create'),
    ('/inventory/configurations/stock-item/:id/view',   '/inventory/configurations/service-item/:id/view'),
    ('/inventory/configurations/stock-item/:id/update', '/inventory/configurations/service-item/:id/update')
) AS map(src_path, dst_path) ON src.path = map.src_path
JOIN modules dst ON dst.path = map.dst_path
ON CONFLICT (role_id, module_id, action) DO NOTHING;
