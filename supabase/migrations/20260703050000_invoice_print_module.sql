-- Print view for Sales Invoice: /sale/invoice/:id/print (action module under
-- /sale/invoice). Permissions copied from the invoice :id/view action so any
-- role that can view an invoice can also print it.

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/sale/invoice/:id/print', 'Print', '/sale/invoice/:id/print', 'SaleInvoicePrint',
       (SELECT id FROM modules WHERE path = '/sale/invoice'), 'action', 4, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/sale/invoice/:id/print');

INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/sale/invoice/:id/view'
JOIN modules dst ON dst.path = '/sale/invoice/:id/print'
ON CONFLICT (role_id, module_id) DO NOTHING;
