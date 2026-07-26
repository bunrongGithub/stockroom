-- ============================================================================
-- Cash Sale history list module.
--
-- A browsable/reprintable list of completed counter sales, under Sale. Its data
-- is loaded in-process by a data-registry loader (module path
-- /sale/cash-sale/history ≠ API path /api/sale/cash-sale), so is_initial_data
-- is true. Permissions mirror the Cash Sale register.
--
-- Idempotent: safe to re-run.
-- ============================================================================

INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/sale/cash-sale/history', 'Sales History', '/sale/cash-sale/history',
       'SaleCashSaleList', m.id, 'transaction', 'ReceiptText', 4, true
FROM modules m
WHERE m.path = '/sale'
  AND NOT EXISTS (
      SELECT 1 FROM modules x WHERE x.path = '/sale/cash-sale/history'
  );

-- Whoever may use the register may view its history.
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/sale/cash-sale'
JOIN modules dst ON dst.path = '/sale/cash-sale/history'
ON CONFLICT (role_id, module_id) DO NOTHING;
