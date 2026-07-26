-- ============================================================================
-- Unit of Measure master — production-ready upgrade
--
-- Turns the bare `inventory_uom` table into a real ERP master:
--   • business code (unique per company), description, active/inactive status,
--     one default per company, created_by + proper updated_at
--   • case-insensitive unique names, delete protection at the DB level
--   • usage view for list/detail + delete-guard
--   • standard-UOM seeding for empty companies and future onboarding
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── 1. Extend inventory_uom ─────────────────────────────────────────────────
ALTER TABLE public.inventory_uom
    ADD COLUMN IF NOT EXISTS code        VARCHAR(20),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_default  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_inventory_uom_updated_at ON public.inventory_uom;
CREATE TRIGGER trg_inventory_uom_updated_at
    BEFORE UPDATE ON public.inventory_uom
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 2. Backfill code + one default per company (existing rows) ──────────────
-- code = uppercased alphanumerics of name, truncated to 16; guaranteed unique
-- per company by appending _<id> to any collision.
WITH base AS (
    SELECT id, company_id,
           upper(left(regexp_replace(coalesce(name, 'UOM'), '[^A-Za-z0-9]', '', 'g'), 16)) AS raw
    FROM public.inventory_uom
    WHERE code IS NULL
),
ranked AS (
    SELECT id, company_id, NULLIF(raw, '') AS raw,
           row_number() OVER (PARTITION BY company_id, raw ORDER BY id) AS rn
    FROM base
)
UPDATE public.inventory_uom u
SET code = CASE
        WHEN r.raw IS NULL THEN 'UOM' || u.id
        WHEN r.rn = 1      THEN r.raw
        ELSE r.raw || '_' || u.id
    END
FROM ranked r
WHERE u.id = r.id;

-- One default per company: the lowest-id row, only if the company has none yet.
UPDATE public.inventory_uom u
SET is_default = true
WHERE u.id IN (
    SELECT DISTINCT ON (company_id) id
    FROM public.inventory_uom
    WHERE company_id NOT IN (
        SELECT company_id FROM public.inventory_uom WHERE is_default GROUP BY company_id
    )
    ORDER BY company_id, id
);

ALTER TABLE public.inventory_uom ALTER COLUMN code SET NOT NULL;

-- ── 3. Constraints + indexes ────────────────────────────────────────────────
ALTER TABLE public.inventory_uom DROP CONSTRAINT IF EXISTS uq_inventory_uom_company_code;
ALTER TABLE public.inventory_uom
    ADD CONSTRAINT uq_inventory_uom_company_code UNIQUE (company_id, code);

-- Case-insensitive unique name per company.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_uom_company_lname
    ON public.inventory_uom (company_id, lower(name));

-- At most one default UOM per company.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_uom_one_default
    ON public.inventory_uom (company_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_inventory_uom_company ON public.inventory_uom (company_id);

-- ── 4. Harden the item → uom FK (CASCADE would delete items with the UOM) ───
ALTER TABLE public.inventory_item DROP CONSTRAINT IF EXISTS inventory_item_uom_id_fkey;
ALTER TABLE public.inventory_item
    ADD CONSTRAINT inventory_item_uom_id_fkey
        FOREIGN KEY (uom_id) REFERENCES public.inventory_uom (id)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- ── 5. Usage view (list + detail item counts) ──────────────────────────────
CREATE OR REPLACE VIEW public.inventory_uom_usage AS
SELECT u.*,
       (SELECT count(*) FROM public.inventory_item i WHERE i.uom_id = u.id) AS item_count
FROM public.inventory_uom u;

-- ── 6. Standard-UOM seeder (safe: only when the company has none) ───────────
CREATE OR REPLACE FUNCTION public.seed_standard_uoms(p_company_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM inventory_uom WHERE company_id = p_company_id) THEN
        RETURN; -- never duplicate an existing company's UOMs
    END IF;

    INSERT INTO inventory_uom (company_id, code, name, display_name, is_active, is_default)
    SELECT p_company_id, s.code, s.name, s.symbol, true, s.is_default
    FROM (VALUES
        ('PCS',   'Pieces',    'pcs', true),
        ('BOX',   'Box',       'box', false),
        ('SET',   'Set',       'set', false),
        ('PAIR',  'Pair',      'pr',  false),
        ('KG',    'Kilogram',  'kg',  false),
        ('METER', 'Meter',     'm',   false),
        ('LITER', 'Liter',     'L',   false)
    ) AS s(code, name, symbol, is_default);
END;
$$;

-- Backfill: seed every existing company that currently has zero UOMs.
DO $$
DECLARE c RECORD;
BEGIN
    FOR c IN SELECT id FROM company LOOP
        PERFORM seed_standard_uoms(c.id);
    END LOOP;
END $$;

-- ── 7. New companies get the standard set at onboarding ─────────────────────
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
    INSERT INTO company (name, domain, status, created_by)
    VALUES (
        p_company_name,
        lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g')),
        'active',
        p_user_id
    )
    RETURNING id INTO v_company_id;

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

    INSERT INTO roles (name, description, company_id)
    VALUES ('owner', 'Company owner — full access to all modules', v_company_id)
    RETURNING id INTO v_role_id;

    INSERT INTO user_role (user_id, role_id, company_id)
    VALUES (p_user_id, v_role_id, v_company_id);

    INSERT INTO role_module_permission
        (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
    SELECT v_role_id, m.id, true, true, true, true, true
    FROM modules m
    WHERE m.is_active = true
    ON CONFLICT (role_id, module_id) DO NOTHING;

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

    -- Standard unit-of-measure master (PCS default) for the new company.
    PERFORM seed_standard_uoms(v_company_id);

    RETURN v_company_id;
END;
$$;

-- ── 8. UOM detail (view) route — the module row never existed, so the detail
--    page (component InventoryUomView) was unreachable. Add it under the UOM
--    parent and mirror permissions from the parent module.
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/configurations/uom/:id/view', 'View',
       '/inventory/configurations/uom/:id/view', 'InventoryUomView',
       m.id, 'action', 'Eye', 2, false
FROM modules m
WHERE m.path = '/inventory/configurations/uom'
  AND NOT EXISTS (
      SELECT 1 FROM modules v
      WHERE v.path = '/inventory/configurations/uom/:id/view'
  );

INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/inventory/configurations/uom'
JOIN modules dst ON dst.path = '/inventory/configurations/uom/:id/view'
ON CONFLICT (role_id, module_id) DO NOTHING;
