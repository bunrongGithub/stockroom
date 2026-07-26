-- ============================================================================
-- Company User Management
--
-- 1. add_company_user() — attach a (already-created) auth user to an EXISTING
--    company with a profile + one or more roles, atomically. Mirror of
--    onboard_company() but WITHOUT creating a company. The TS caller creates
--    the auth user (admin API, can't join a Postgres tx) then calls this;
--    on failure it compensates by deleting the auth user.
-- 2. Module action rows for /setting/users create/view/update (the catch-all
--    resolves routes against the modules table, so each action needs a row).
--
-- No new columns — profiles already has status/phone/last_login_at and
-- user_role already supports multiple roles per user.
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION add_company_user(
    p_user_id     UUID,
    p_company_id  BIGINT,
    p_full_name   TEXT,
    p_phone       TEXT,
    p_status      TEXT,
    p_role_ids    BIGINT[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bad_role BIGINT;
BEGIN
    -- Every role must belong to the target company (cross-company guard).
    SELECT r FROM unnest(p_role_ids) AS r
    WHERE r NOT IN (SELECT id FROM roles WHERE company_id = p_company_id)
    LIMIT 1
    INTO v_bad_role;

    IF v_bad_role IS NOT NULL THEN
        RAISE EXCEPTION 'Role % does not belong to company %', v_bad_role, p_company_id;
    END IF;

    -- Profile (the auth user already exists; profile row may or may not).
    INSERT INTO profiles (id, company_id, full_name, phone, status)
    VALUES (
        p_user_id,
        p_company_id,
        COALESCE(NULLIF(p_full_name, ''), 'User'),
        NULLIF(p_phone, ''),
        COALESCE(NULLIF(p_status, ''), 'active')
    )
    ON CONFLICT (id) DO UPDATE
        SET company_id = EXCLUDED.company_id,
            full_name  = EXCLUDED.full_name,
            phone      = EXCLUDED.phone,
            status     = EXCLUDED.status;

    -- Role memberships (unique on (user_id, role_id, company_id)).
    INSERT INTO user_role (user_id, role_id, company_id)
    SELECT p_user_id, r, p_company_id
    FROM unnest(p_role_ids) AS r
    ON CONFLICT (user_id, role_id, company_id) DO NOTHING;
END;
$$;

-- ── Module action rows for /setting/users ───────────────────────────────────
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT v.key, v.label, v.path, v.component,
       (SELECT id FROM modules WHERE path = '/setting/users'),
       'action', v.icon, v.sort_order, false
FROM (VALUES
    ('/setting/users/create',     'Create', '/setting/users/create',     'UserCreate', 'Plus',  1),
    ('/setting/users/:id/view',   'View',   '/setting/users/:id/view',   'UserView',   'Eye',   2),
    ('/setting/users/:id/update', 'Update', '/setting/users/:id/update', 'UserUpdate', 'Edit2', 3)
) AS v(key, label, path, component, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM modules m WHERE m.path = v.path);

-- Copy permissions from the parent /setting/users module onto the new actions.
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/setting/users'
JOIN modules dst ON dst.path IN (
    '/setting/users/create',
    '/setting/users/:id/view',
    '/setting/users/:id/update'
)
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Ensure the dev super-admin role (1) can reach every /setting/users route.
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT 1, m.id, true, true, true, true, true
FROM modules m WHERE m.path LIKE '/setting/users%'
ON CONFLICT (role_id, module_id) DO UPDATE
    SET can_view = true, can_create = true, can_update = true, can_delete = true, can_export = true;
