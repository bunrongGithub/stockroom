-- ============================================================================
-- Backfill extended-action grants for roles created AFTER the authorization
-- migration.
--
-- The original seed (20260720000000) derived post/void/approve/… from the CRUD
-- flags for roles existing at that time. Roles created since (e.g. a new
-- company's roles) never got them, so their Post/Void buttons stay hidden even
-- with Edit/Delete granted. Re-run the same derivation for ALL current roles;
-- role.updatePermissions now keeps this in sync going forward.
--
-- Idempotent (ON CONFLICT DO NOTHING). Mirrors the permissions.ts
-- EXTENDED_ACTION_BASE mapping.
-- ============================================================================

INSERT INTO public.role_module_action_permission (role_id, module_id, company_id, action, granted)
SELECT rmp.role_id, rmp.module_id, coalesce(rmp.company_id, r.company_id), m.action, true
FROM public.role_module_permission rmp
JOIN public.roles r    ON r.id  = rmp.role_id
JOIN public.modules mo ON mo.id = rmp.module_id
JOIN (VALUES
    ('/inventory/receipts',     'post',     'update'),
    ('/inventory/receipts',     'void',     'delete'),
    ('/inventory/stock_adjust', 'post',     'update'),
    ('/inventory/stock_adjust', 'void',     'delete'),
    ('/inventory/stock_count',  'prepare',  'update'),
    ('/inventory/stock_count',  'count',    'update'),
    ('/inventory/stock_count',  'approve',  'update'),
    ('/inventory/stock_count',  'complete', 'update'),
    ('/inventory/stock_count',  'cancel',   'delete'),
    ('/sale/delivery-note',     'post',     'update'),
    ('/sale/delivery-note',     'void',     'delete'),
    ('/finances/invoice',       'post',     'update'),
    ('/finances/invoice',       'approve',  'update'),
    ('/finances/invoice',       'cancel',   'delete'),
    ('/finances/payment',       'post',     'update'),
    ('/finances/payment',       'cancel',   'delete'),
    ('/sale/order',             'close',    'update'),
    ('/sale/order',             'cancel',   'delete')
) AS m(module_key, action, base_cap) ON mo.key = m.module_key
WHERE coalesce(rmp.company_id, r.company_id) IS NOT NULL
  AND ((m.base_cap = 'update' AND rmp.can_update = true)
    OR (m.base_cap = 'delete' AND rmp.can_delete = true))
ON CONFLICT (role_id, module_id, action) DO NOTHING;
