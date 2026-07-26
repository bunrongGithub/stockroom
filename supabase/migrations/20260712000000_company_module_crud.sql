-- ============================================================================
-- Company module CRUD
-- 1. create_company() RPC — create a company WITHOUT an owning user (super
--    admin flow from /setting/company/create). Seeds the owner role with full
--    module permissions and the document sequences, mirroring
--    onboard_company(), so users can be assigned into the company later.
-- 2. Module action rows for /setting/company create/view/update (the
--    catch-all resolves routes against the modules table, so each action
--    needs a row).
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_company(
    p_name                TEXT,
    p_created_by          UUID DEFAULT NULL,
    p_registration_number TEXT DEFAULT NULL,
    p_tax_number          TEXT DEFAULT NULL,
    p_phone               TEXT DEFAULT NULL,
    p_email               TEXT DEFAULT NULL,
    p_website             TEXT DEFAULT NULL,
    p_address             TEXT DEFAULT NULL,
    p_description         TEXT DEFAULT NULL,
    p_status              TEXT DEFAULT 'active'
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
    INSERT INTO company (
        name, domain, registration_number, tax_number, phone, email,
        website, address, description, status, created_by
    )
    VALUES (
        p_name,
        lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')),
        NULLIF(p_registration_number, ''),
        NULLIF(p_tax_number, ''),
        NULLIF(p_phone, ''),
        NULLIF(p_email, ''),
        NULLIF(p_website, ''),
        NULLIF(p_address, ''),
        NULLIF(p_description, ''),
        COALESCE(NULLIF(p_status, ''), 'active'),
        p_created_by
    )
    RETURNING id INTO v_company_id;

    -- 2. Per-company Owner role
    INSERT INTO roles (name, description, company_id)
    VALUES ('owner', 'Company owner — full access to all modules', v_company_id)
    RETURNING id INTO v_role_id;

    -- 3. Owner gets every permission on every active module
    INSERT INTO role_module_permission
        (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
    SELECT v_role_id, m.id, true, true, true, true, true
    FROM modules m
    WHERE m.is_active = true
    ON CONFLICT (role_id, module_id) DO NOTHING;

    -- 4. Document sequences (next_document_number also lazy-seeds; upfront hygiene)
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

-- ── Module action rows for /setting/company ─────────────────────────────────

INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT v.key, v.label, v.path, v.component,
       (SELECT id FROM modules WHERE path = '/setting/company'),
       'action', v.icon, v.sort_order, false
FROM (VALUES
    ('/setting/company/create',     'Create', '/setting/company/create',     'CompanyCreate', 'Plus',  1),
    ('/setting/company/:id/view',   'View',   '/setting/company/:id/view',   'CompanyView',   'Eye',   2),
    ('/setting/company/:id/update', 'Update', '/setting/company/:id/update', 'CompanyUpdate', 'Edit2', 3)
) AS v(key, label, path, component, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM modules m WHERE m.path = v.path);

-- The list page preloads paginated data from /api/setting/company.
UPDATE modules SET is_initial_data = true WHERE path = '/setting/company';

-- Copy permissions from the parent /setting/company module onto the actions.
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/setting/company'
JOIN modules dst ON dst.path IN (
    '/setting/company/create',
    '/setting/company/:id/view',
    '/setting/company/:id/update'
)
ON CONFLICT (role_id, module_id) DO NOTHING;
