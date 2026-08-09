-- ═══════════════════════════════════════════════════════════════════════════
-- Document Sequence core — make numbering configurable.
--
-- The sequence framework already exists and is correct: document_sequence
-- holds a per company × doc_type counter, and next_document_number() allocates
-- from it with a single atomic UPDATE … RETURNING. What it cannot do is let an
-- administrator change how a number LOOKS — the format is hardcoded in SQL as
-- prefix-[year-]padded. This migration turns that shape into data.
--
-- Behaviour is deliberately UNCHANGED by this migration. Every existing row is
-- backfilled with the format template that reproduces its current output byte
-- for byte, so no counter moves and no document number changes. Adopting a new
-- format becomes a deliberate action in Settings → Document Numbering.
--
--   1. format         template over a closed token set, rendered in TypeScript
--                     (service/core/document-format.ts) so preview and live
--                     generation share one implementation
--   2. is_active      retire a sequence without discarding its counter
--   3. audit columns  created_by / updated_by, matching every other master
--   4. reset rules    monthly and daily join never and yearly
--   5. seeding        one canonical default list instead of the same VALUES
--                     block copy-pasted into two onboarding functions
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Configuration columns ────────────────────────────────────────────────
ALTER TABLE public.document_sequence
    ADD COLUMN IF NOT EXISTS format     VARCHAR(120) NOT NULL DEFAULT '{PREFIX}-{NUMBER}',
    ADD COLUMN IF NOT EXISTS is_active  BOOLEAN      NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

-- Prefixes become administrator-editable, so 10 characters is tight.
ALTER TABLE public.document_sequence
    ALTER COLUMN prefix TYPE VARCHAR(20);

-- ── 2. Backfill the format that reproduces today's output exactly ───────────
-- Old generator:  prefix || '-' || (yearly ? period_key || '-' : '') || lpad(n)
-- The DEFAULT above already gives every row the 'never' shape; only the yearly
-- rows need the year token. period_key was always stamped to the CURRENT year
-- in the same statement that returned it, so {YEAR} renders the same value.
UPDATE public.document_sequence
   SET format = '{PREFIX}-{YEAR}-{NUMBER}'
 WHERE reset_rule = 'yearly';

-- ── 3. Business rules ───────────────────────────────────────────────────────
ALTER TABLE public.document_sequence
    DROP CONSTRAINT IF EXISTS chk_document_sequence_reset;

ALTER TABLE public.document_sequence
    ADD CONSTRAINT chk_document_sequence_reset
        CHECK (reset_rule IN ('never', 'yearly', 'monthly', 'daily'));

DO $$ BEGIN
    ALTER TABLE public.document_sequence
        ADD CONSTRAINT chk_document_sequence_padding
        CHECK (padding BETWEEN 1 AND 12);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A format without the counter renders one constant string for every document,
-- and the per-company unique index on each document table would then reject
-- every insert after the first. Make it unsavable rather than discoverable in
-- production.
DO $$ BEGIN
    ALTER TABLE public.document_sequence
        ADD CONSTRAINT chk_document_sequence_format
        CHECK (format LIKE '%{NUMBER}%');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- doc_type is a stable system identifier, never a display label.
DO $$ BEGIN
    ALTER TABLE public.document_sequence
        ADD CONSTRAINT chk_document_sequence_doc_type
        CHECK (doc_type ~ '^[a-z][a-z0-9_]*$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. One canonical seed list ──────────────────────────────────────────────
-- Both onboarding functions carried an identical copy of this VALUES block, so
-- a new document type had to be added in two places and inevitably drifted.
--
-- Seeding is convenience, not correctness: next_document_number() lazy-seeds
-- any missing row on first use. It exists so a newly onboarded company can
-- configure its numbering before creating its first document.
--
-- inventory_receipt seeds GRN here. Companies already minting RCT keep it —
-- ON CONFLICT DO NOTHING never touches an existing row, and their counter is
-- mid-sequence. They change it in Settings when they choose to.
CREATE OR REPLACE FUNCTION public.seed_document_sequences(p_company_id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.document_sequence (company_id, doc_type, prefix)
    SELECT p_company_id, d.doc_type, d.prefix
    FROM (VALUES
        ('sales_order',        'SO'),
        ('cash_sale',          'CS'),
        ('sales_shipment',     'SHP'),
        ('sales_invoice',      'INV'),
        ('customer_payment',   'PAY'),
        ('inventory_receipt',  'GRN'),
        ('inventory_movement', 'MOV'),
        ('stock_adjustment',   'ADJ'),
        ('stock_count',        'SC')
    ) AS d(doc_type, prefix)
    ON CONFLICT (company_id, doc_type) DO NOTHING;
END $$;

COMMENT ON FUNCTION public.seed_document_sequences(INT) IS
    'Canonical default prefixes for a new company. Mirrors DOCUMENT_TYPES in '
    'service/core/document-types.ts; kept in step by tests/document-registry.test.ts.';

-- ── 5. Point both onboarding functions at it ────────────────────────────────
-- Bodies below are the live definitions with the inline VALUES block replaced
-- by the call; nothing else was touched.

CREATE OR REPLACE FUNCTION public.onboard_company(p_user_id uuid, p_email text, p_full_name text, p_company_name text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    PERFORM public.seed_document_sequences(v_company_id);

    -- Standard unit-of-measure master (PCS default) for the new company.
    PERFORM seed_standard_uoms(v_company_id);

    RETURN v_company_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_company(p_name text, p_created_by uuid DEFAULT NULL::uuid, p_registration_number text DEFAULT NULL::text, p_tax_number text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_website text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_status text DEFAULT 'active'::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    PERFORM public.seed_document_sequences(v_company_id);

    RETURN v_company_id;
END;
$function$;


-- ── 6. Give every existing company a full set of rows ───────────────────────
-- Purely additive: ON CONFLICT DO NOTHING means a company already minting RCT
-- keeps RCT and its counter, and a hand-edited prefix survives. This only fills
-- in types a company has never used — including cash_sale, which is new — so
-- that Settings → Document Numbering lists everything from the first visit
-- rather than growing entries as documents happen to get created.
DO $$
DECLARE
    v_company RECORD;
BEGIN
    FOR v_company IN SELECT id FROM public.company LOOP
        PERFORM public.seed_document_sequences(v_company.id::int);
    END LOOP;
END $$;

-- ── 7. Defence in depth on the allocator ────────────────────────────────────
-- next_document_number is SECURITY INVOKER and document_sequence is RLS
-- deny-all, so a browser-side caller could never consume another tenant's
-- counter. Revoking EXECUTE says so explicitly instead of relying on it.
REVOKE ALL ON FUNCTION public.next_document_number(INT, VARCHAR, VARCHAR)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_document_sequences(INT)
    FROM PUBLIC, anon, authenticated;

-- ── Documentation ───────────────────────────────────────────────────────────
COMMENT ON COLUMN public.document_sequence.format IS
    'Token template rendered by service/core/document-format.ts. Closed token '
    'set: {PREFIX} {YEAR} {YY} {MONTH} {DAY} {NUMBER}. Must contain {NUMBER}.';
COMMENT ON COLUMN public.document_sequence.reset_rule IS
    'never | yearly | monthly | daily. Lazy: the counter resets on the first '
    'allocation after the period boundary, never on a schedule. Only meaningful '
    'when the format carries the matching period token.';
COMMENT ON COLUMN public.document_sequence.is_active IS
    'False retires a sequence WITHOUT discarding its counter. Deleting the row '
    'would let the next allocation re-seed at 1 and collide with live documents.';
COMMENT ON COLUMN public.document_sequence.next_value IS
    'The next number to issue. Not editable through the configuration UI: '
    'moving it backwards mints numbers that collide with existing documents.';
