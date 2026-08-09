-- ═══════════════════════════════════════════════════════════════════════════
-- Settings → Document Numbering: the module row and its grants.
--
-- Two tables have to agree before a page is reachable:
--   modules                        makes the route resolve at all
--   role_module_action_permission  makes get_user_modules return can_view
--
-- A modules row on its own is the classic failure here: the dashboard's
-- catch-all gates every page on can_view, can_view is derived per module id
-- from the grant table, and a module with no grants therefore renders as
-- notFound() → /unauthorized for everyone including the owner.
--
-- Grants mirror /setting/role, which is the closest existing analogue: an
-- administrative configuration screen that a role either fully manages or
-- cannot see. Anyone who can already administer roles can administer
-- numbering; nobody else gains anything.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. The page ─────────────────────────────────────────────────────────────
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/setting/document-numbering',
       'Numbering',
       '/setting/document-numbering',
       'DocumentNumbering',
       (SELECT id FROM modules WHERE path = '/setting'),
       'transaction',
       'Hash',
       5,
       -- The page loads its own list through the configuration API, which
       -- decorates each row with registry metadata and a rendered preview.
       -- A generic paginated preload could not produce either.
       false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/setting/document-numbering');

-- ── 2. Legacy CRUD flags, mirrored from Role ────────────────────────────────
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id,
       rmp.can_view, rmp.can_create, rmp.can_update,
       false,   -- there is no delete: retiring a sequence is is_active = false
       false
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/setting/role'
JOIN modules dst ON dst.path = '/setting/document-numbering'
ON CONFLICT (role_id, module_id) DO NOTHING;

-- ── 3. Per-action grants — what runtime authorization actually reads ────────
INSERT INTO role_module_action_permission (role_id, module_id, company_id, action, granted)
SELECT ap.role_id, dst.id, ap.company_id, ap.action, ap.granted
FROM role_module_action_permission ap
JOIN modules src ON src.id = ap.module_id AND src.path = '/setting/role'
JOIN modules dst ON dst.path = '/setting/document-numbering'
WHERE ap.action IN ('view', 'create', 'update')
ON CONFLICT (role_id, module_id, action) DO NOTHING;
