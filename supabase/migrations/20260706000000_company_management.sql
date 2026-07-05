-- ============================================================================
-- Company Management + Transactional Onboarding
--
-- 1. Extend `company` into a real root entity (contacts, status, branding,
--    audit columns).
-- 2. Codify live-DB drift: profiles.is_super_user + user_profiles_view exist
--    in the database but in no migration — a fresh `db reset` breaks without
--    this file.
-- 3. roles: global UNIQUE(name) → UNIQUE(company_id, name) so every company
--    can have its own 'owner' role.
-- 4. onboard_company() RPC — the single-transaction onboarding unit:
--    company → profile → owner role → membership → full permissions →
--    document sequences. Any failure rolls back everything; the TS caller
--    compensates by deleting the auth user.
-- 5. Storage bucket `company-assets` for logos (public read, service-role
--    writes — no RLS policies needed).
-- 6. Ensure /setting/company module row + permissions (copy from
--    /setting/role, same pattern as the stock_adjustment migration).
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── 1. Company: root-entity columns ─────────────────────────────────────────

ALTER TABLE company
    ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS tax_number          VARCHAR(100),
    ADD COLUMN IF NOT EXISTS phone               VARCHAR(50),
    ADD COLUMN IF NOT EXISTS email               VARCHAR(255),
    ADD COLUMN IF NOT EXISTS website             VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address             TEXT,
    ADD COLUMN IF NOT EXISTS description         TEXT,
    ADD COLUMN IF NOT EXISTS logo_url            TEXT,
    ADD COLUMN IF NOT EXISTS status              VARCHAR(20) NOT NULL DEFAULT 'active',
    -- auth.users, not profiles: inside onboard_company() the company row is
    -- inserted before the profile exists.
    ADD COLUMN IF NOT EXISTS created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE company DROP CONSTRAINT IF EXISTS chk_company_status;
ALTER TABLE company ADD CONSTRAINT chk_company_status
    CHECK (status IN ('active', 'inactive', 'suspended'));

DROP TRIGGER IF EXISTS trg_company_updated_at ON company;
CREATE TRIGGER trg_company_updated_at
    BEFORE UPDATE ON company
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 2. Profiles: codify drift + light extension ─────────────────────────────

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_super_user BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS phone         VARCHAR(50),
    ADD COLUMN IF NOT EXISTS status        VARCHAR(20) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_status;
ALTER TABLE profiles ADD CONSTRAINT chk_profiles_status
    CHECK (status IN ('active', 'inactive'));

-- ── 3. Roles: per-company role names ────────────────────────────────────────

ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;
ALTER TABLE roles DROP CONSTRAINT IF EXISTS uq_roles_company_name;
ALTER TABLE roles ADD CONSTRAINT uq_roles_company_name UNIQUE (company_id, name);

-- ── 4. user_profiles_view: codify + extend ──────────────────────────────────
-- The first 7 columns must stay in the live view's exact order for
-- CREATE OR REPLACE; new columns are appended only.

CREATE OR REPLACE VIEW user_profiles_view AS
SELECT p.id,
       p.full_name,
       u.email,
       p.avatar_url,
       p.company_id,
       c.name AS company_name,
       p.created_at,
       p.status,
       p.phone,
       p.last_login_at,
       COALESCE((
           SELECT json_agg(json_build_object('id', r.id, 'name', r.name))
           FROM user_role ur
           JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = p.id AND ur.company_id = p.company_id
       ), '[]'::json) AS roles
FROM profiles p
JOIN auth.users u ON p.id = u.id
LEFT JOIN company c ON c.id = p.company_id;

-- ── 5. Transactional onboarding RPC ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION onboard_company(
    p_user_id      UUID,
    p_email        TEXT,
    p_full_name    TEXT,
    p_company_name TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id BIGINT;
    v_role_id    BIGINT;
BEGIN
    -- 1. Company (unique name → 23505 aborts the whole transaction)
    INSERT INTO company (name, domain, status, created_by)
    VALUES (
        p_company_name,
        lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g')),
        'active',
        p_user_id
    )
    RETURNING id INTO v_company_id;

    -- 2. Profile (auth user already exists; profile row may or may not)
    INSERT INTO profiles (id, company_id, full_name, status)
    VALUES (
        p_user_id,
        v_company_id,
        COALESCE(NULLIF(p_full_name, ''), split_part(p_email, '@', 1)),
        'active'
    )
    ON CONFLICT (id) DO UPDATE
        SET company_id = EXCLUDED.company_id,
            full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name);

    -- 3. Per-company Owner role
    INSERT INTO roles (name, description, company_id)
    VALUES ('owner', 'Company owner — full access to all modules', v_company_id)
    RETURNING id INTO v_role_id;

    -- 4. Membership
    INSERT INTO user_role (user_id, role_id, company_id)
    VALUES (p_user_id, v_role_id, v_company_id);

    -- 5. Owner gets every permission on every active module
    INSERT INTO role_module_permission
        (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
    SELECT v_role_id, m.id, true, true, true, true, true
    FROM modules m
    WHERE m.is_active = true
    ON CONFLICT (role_id, module_id) DO NOTHING;

    -- 6. Document sequences (next_document_number also lazy-seeds; upfront hygiene)
    INSERT INTO document_sequence (company_id, doc_type, prefix)
    SELECT v_company_id, d.doc_type, d.prefix
    FROM (VALUES
        ('sales_order', 'SO'),
        ('sales_shipment', 'SHP'),
        ('sales_invoice', 'INV'),
        ('inventory_receipt', 'RCT'),
        ('inventory_movement', 'MOV'),
        ('customer_payment', 'PAY'),
        ('stock_adjustment', 'ADJ'),
        ('purchase_order', 'PO')
    ) AS d(doc_type, prefix)
    ON CONFLICT (company_id, doc_type) DO NOTHING;

    RETURN v_company_id;
END;
$$;

-- ── 6. Storage bucket for company logos ─────────────────────────────────────
-- public=true → reads via /storage/v1/object/public/... without policies;
-- writes go through the service-role client which bypasses RLS.

INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ── 7. Module row + permissions ─────────────────────────────────────────────

INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/setting/company', 'Company', '/setting/company', 'Company',
       (SELECT id FROM modules WHERE path = '/setting'),
       'transaction', 'Building2', 5, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/setting/company');

INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/setting/role'
JOIN modules dst ON dst.path = '/setting/company'
ON CONFLICT (role_id, module_id) DO NOTHING;
