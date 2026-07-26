-- ═══════════════════════════════════════════════════════════════════════════
-- Master Data — Business Partner
--
-- Introduces the ERP's relationship hub: ONE entity for every customer,
-- supplier, vendor, employee and carrier, wearing one or more ROLES. Replaces
-- the `customer` stub added with Cash Sale (20260714000000).
--
-- Strategy: RENAME the existing table rather than create a new one. Postgres
-- carries rows, indexes and — critically — the three existing customer_id
-- foreign keys (sales_order, sales_invoice, customer_payment) through a
-- rename, so this is a zero-data-movement migration.
--
-- The documents keep their free-text customer_name/customer_phone SNAPSHOT
-- columns forever (a printed invoice must never change when a partner is
-- renamed) and keep the column name `customer_id` — on a sales order that
-- field means "the partner acting as our customer here", exactly how SAP B1
-- models it. A future purchase order will use supplier_id against this table.
--
-- Sections:
--   1. Rename + extend business_partner
--   2. Partner codes (BP-000001) via the atomic sequence framework
--   3. business_partner_role  — the many-roles-per-partner join
--   4. business_partner_address — multiple addresses, default billing/shipping
--   5. business_partner_contact — multiple contacts per partner
--   6. Backfill: customer role + address rows for existing partners
--   7. Sales chain completeness (sales_shipment.customer_id, better indexes)
--   8. Module rows: /master-data root + Business Partners + action rows
--   9. Permissions: role_module_permission AND role_module_action_permission
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Rename + extend ─────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'customer')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'business_partner')
    THEN
        ALTER TABLE public.customer RENAME TO business_partner;
        -- Triggers/indexes survive a rename but keep their old names; rename
        -- them too so the schema reads coherently.
        ALTER TRIGGER trg_customer_updated_at   ON public.business_partner
            RENAME TO trg_business_partner_updated_at;
        ALTER TRIGGER trg_customer_audit_guard  ON public.business_partner
            RENAME TO trg_business_partner_audit_guard;
    END IF;
END $$;

-- A fresh database (no Cash Sale history) needs the table created outright.
CREATE TABLE IF NOT EXISTS public.business_partner (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id   BIGINT NOT NULL REFERENCES public.company (id) ON DELETE CASCADE,
    user_id      UUID REFERENCES public.profiles (id),
    name         VARCHAR(200) NOT NULL,
    phone        VARCHAR(50),
    email        VARCHAR(200),
    address      TEXT,       -- DEPRECATED: superseded by business_partner_address
    notes        TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    updated_by   UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

ALTER TABLE public.business_partner
    -- Identity: the code is PERMANENT. Names and phones change; this does not.
    ADD COLUMN IF NOT EXISTS code                varchar(30),
    ADD COLUMN IF NOT EXISTS company_name        varchar(200),
    ADD COLUMN IF NOT EXISTS partner_kind        varchar(20) NOT NULL DEFAULT 'organization',
    -- Contact
    ADD COLUMN IF NOT EXISTS phone_alt           varchar(50),
    ADD COLUMN IF NOT EXISTS website             varchar(200),
    -- Business registration
    ADD COLUMN IF NOT EXISTS tax_number          varchar(50),
    ADD COLUMN IF NOT EXISTS vat_number          varchar(50),
    ADD COLUMN IF NOT EXISTS registration_number varchar(50),
    -- Financial
    ADD COLUMN IF NOT EXISTS credit_limit        numeric(18,4),
    ADD COLUMN IF NOT EXISTS payment_term_days   integer,
    -- FK deliberately omitted: the payment_term table lands with the Payment
    -- Terms feature. payment_term_days is the usable field until then.
    ADD COLUMN IF NOT EXISTS payment_term_id     bigint,
    ADD COLUMN IF NOT EXISTS currency            varchar(3) NOT NULL DEFAULT 'USD';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'business_partner_kind_check') THEN
        ALTER TABLE public.business_partner
            ADD CONSTRAINT business_partner_kind_check
            CHECK (partner_kind IN ('organization', 'individual'));
    END IF;
END $$;

ALTER TABLE public.business_partner ENABLE ROW LEVEL SECURITY;

-- Existing rows all came from the Cash Sale counter, i.e. walk-in people.
UPDATE public.business_partner SET partner_kind = 'individual'
WHERE partner_kind = 'organization' AND created_at < now();

-- ── 2. Partner codes ───────────────────────────────────────────────────────
-- Assigned through next_document_number so the sequence is left in a correct
-- state: the oldest partner becomes BP-000001 and the next partner created by
-- the app continues from there.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT id, company_id FROM public.business_partner
        WHERE code IS NULL ORDER BY company_id, id
    LOOP
        UPDATE public.business_partner
        SET code = public.next_document_number(r.company_id::int,
                                               'business_partner', 'BP')
        WHERE id = r.id;
    END LOOP;
END $$;

ALTER TABLE public.business_partner ALTER COLUMN code SET NOT NULL;

-- The code is now the identity. Drop the old (name, phone) uniqueness: both
-- are mutable, and two partners may legitimately share a phone number
-- (a family, a company switchboard) — duplicates are surfaced as a warning by
-- the API instead of being rejected by the database.
DROP INDEX IF EXISTS public.uq_customer_company_name_phone;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_partner_company_code
    ON public.business_partner (company_id, code);
CREATE INDEX IF NOT EXISTS idx_business_partner_company_phone
    ON public.business_partner (company_id, phone);
CREATE INDEX IF NOT EXISTS idx_business_partner_company_name
    ON public.business_partner (company_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_business_partner_company_active
    ON public.business_partner (company_id, is_active);

-- Legacy index names left by the rename.
DROP INDEX IF EXISTS public.idx_customer_company_phone;
DROP INDEX IF EXISTS public.idx_customer_company_name;

-- ── 3. Roles ───────────────────────────────────────────────────────────────
-- A child table, not a text[] column: roles grow their own attributes later
-- (customer group, supplier group, price list, tax profile) and this absorbs
-- them without restructuring.
CREATE TABLE IF NOT EXISTS public.business_partner_role (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES public.company (id) ON DELETE CASCADE,
    partner_id BIGINT NOT NULL REFERENCES public.business_partner (id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL
                   CHECK (role IN ('customer','supplier','employee','carrier','vendor')),
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    CONSTRAINT uq_business_partner_role UNIQUE (partner_id, role)
);

ALTER TABLE public.business_partner_role ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bp_role_company_role
    ON public.business_partner_role (company_id, role);

-- ── 4. Addresses ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_partner_address (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id         BIGINT NOT NULL REFERENCES public.company (id) ON DELETE CASCADE,
    partner_id         BIGINT NOT NULL REFERENCES public.business_partner (id) ON DELETE CASCADE,
    address_type       VARCHAR(20) NOT NULL DEFAULT 'both'
                           CHECK (address_type IN ('billing','shipping','both','other')),
    label              VARCHAR(100),
    country            VARCHAR(100),
    province           VARCHAR(100),
    district           VARCHAR(100),
    commune            VARCHAR(100),
    street             TEXT,
    postal_code        VARCHAR(20),
    is_default_billing  BOOLEAN NOT NULL DEFAULT false,
    is_default_shipping BOOLEAN NOT NULL DEFAULT false,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by         UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    updated_by         UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

ALTER TABLE public.business_partner_address ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bp_address_partner
    ON public.business_partner_address (partner_id);
-- At most one default of each kind per partner.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bp_address_default_billing
    ON public.business_partner_address (partner_id) WHERE is_default_billing;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bp_address_default_shipping
    ON public.business_partner_address (partner_id) WHERE is_default_shipping;

-- ── 5. Contacts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_partner_contact (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES public.company (id) ON DELETE CASCADE,
    partner_id BIGINT NOT NULL REFERENCES public.business_partner (id) ON DELETE CASCADE,
    name       VARCHAR(200) NOT NULL,
    position   VARCHAR(100),
    phone      VARCHAR(50),
    email      VARCHAR(200),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    notes      TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

ALTER TABLE public.business_partner_contact ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bp_contact_partner
    ON public.business_partner_contact (partner_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bp_contact_primary
    ON public.business_partner_contact (partner_id) WHERE is_primary;

-- updated_at triggers for the three new tables.
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['business_partner_role',
                             'business_partner_address',
                             'business_partner_contact']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
                       'trg_'||t||'_updated_at', t);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at()',
            'trg_'||t||'_updated_at', t);
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
                       'trg_'||t||'_audit_guard', t);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.fn_audit_guard()',
            'trg_'||t||'_audit_guard', t);
    END LOOP;
END $$;

-- ── 6. Backfill roles and addresses for existing partners ──────────────────
-- Every pre-existing row came from Sales, so it plays the customer role.
INSERT INTO public.business_partner_role (company_id, partner_id, role, created_by, updated_by)
SELECT bp.company_id, bp.id, 'customer', bp.created_by, bp.updated_by
FROM public.business_partner bp
ON CONFLICT (partner_id, role) DO NOTHING;

-- Preserve the deprecated free-text address as a primary address row rather
-- than discarding it.
INSERT INTO public.business_partner_address (
    company_id, partner_id, address_type, label, street,
    is_default_billing, is_default_shipping, created_by, updated_by)
SELECT bp.company_id, bp.id, 'both', 'Primary', bp.address,
       true, true, bp.created_by, bp.updated_by
FROM public.business_partner bp
WHERE bp.address IS NOT NULL
  AND btrim(bp.address) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.business_partner_address a
                  WHERE a.partner_id = bp.id);

-- ── 7. Sales chain completeness ────────────────────────────────────────────
-- sales_shipment was the only sales document with no partner link.
ALTER TABLE public.sales_shipment
    ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES public.business_partner (id);

-- Payments were indexed on the free-text name; index the link instead.
DROP INDEX IF EXISTS public.idx_customer_payment_customer;
CREATE INDEX IF NOT EXISTS idx_customer_payment_partner
    ON public.customer_payment (company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_partner
    ON public.sales_order (company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_partner
    ON public.sales_invoice (company_id, customer_id);

-- ── 8. Module rows ─────────────────────────────────────────────────────────
-- Root: Master Data sits above Inventory — masters precede transactions, and
-- future children (Payment Terms, Taxes, Currency, Price Lists, Banks) slot in
-- as siblings with no structural change.
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/master-data', 'Master Data', '/master-data', 'MasterDataRootPage',
       NULL, 'transaction', 'BookUser', 1, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/master-data');

INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/master-data/business-partner', 'Business Partners',
       '/master-data/business-partner', 'BusinessPartnerModule',
       (SELECT id FROM modules WHERE path = '/master-data'),
       'transaction', 'Contact', 1, true
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/master-data/business-partner');

INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT v.key, v.label, v.path, v.component,
       (SELECT id FROM modules WHERE path = '/master-data/business-partner'),
       'action', v.icon, v.sort_order, false
FROM (VALUES
    ('/master-data/business-partner/create',     'Create', '/master-data/business-partner/create',     'BusinessPartnerCreate', 'Plus',  1),
    ('/master-data/business-partner/:id/view',   'View',   '/master-data/business-partner/:id/view',   'BusinessPartnerDetail', 'Eye',   2),
    ('/master-data/business-partner/:id/update', 'Update', '/master-data/business-partner/:id/update', 'BusinessPartnerUpdate', 'Edit2', 3)
) AS v(key, label, path, component, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM modules m WHERE m.path = v.path);

-- ── 9. Permissions ─────────────────────────────────────────────────────────
-- Mirror the Sales Order module's grants: anyone who can run sales can find
-- and create partners. Update/delete are granted only where the source role
-- already had them on sales orders.
INSERT INTO role_module_permission (role_id, module_id, company_id,
                                    can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.company_id,
       rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/sale/order'
JOIN modules dst ON dst.path IN (
    '/master-data',
    '/master-data/business-partner',
    '/master-data/business-partner/create',
    '/master-data/business-partner/:id/view',
    '/master-data/business-partner/:id/update')
ON CONFLICT (role_id, module_id) DO NOTHING;

-- Runtime authz reads role_module_action_permission ONLY (get_user_modules,
-- since 20260720010000). Without these rows the module is invisible.
INSERT INTO role_module_action_permission (role_id, module_id, company_id, action, granted)
SELECT ap.role_id, dst.id, ap.company_id, ap.action, ap.granted
FROM role_module_action_permission ap
JOIN modules src ON src.id = ap.module_id AND src.path = '/sale/order'
JOIN modules dst ON dst.path IN (
    '/master-data',
    '/master-data/business-partner',
    '/master-data/business-partner/create',
    '/master-data/business-partner/:id/view',
    '/master-data/business-partner/:id/update')
WHERE ap.action IN ('view', 'create', 'update', 'delete', 'export')
ON CONFLICT (role_id, module_id, action) DO NOTHING;
