-- ============================================================================
-- Shared Audit Metadata framework — created_by / updated_by everywhere.
--
-- Adds created_by + updated_by (→ profiles.id) to every supported header/master
-- table, normalizes the created_at/updated_at timestamps, backfills created_by
-- from the legacy creator column, and locks the provenance fields down with an
-- immutability trigger. Additive and backward-compatible: legacy `user_id` /
-- `writed_at` columns are KEPT (deprecated), and existing data is preserved.
--
-- Ordering is deliberate: columns → backfill → timestamps → updated_at triggers
-- → audit-guard trigger LAST (the guard pins created_by/created_at, so it must
-- not be active while the backfill is still writing created_by).
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── 1. created_by / updated_by columns + FKs ────────────────────────────────
DO $$
DECLARE
    t text;
    -- Every supported table gets updated_by.
    all_tables text[] := ARRAY[
        'inventory_item','inventory_uom','inventory_item_category','warehouse',
        'warehouse_location','customer','company','company_settings','roles',
        'user_role','profiles','receipt_transaction','stock_adjustment',
        'inventory_movement','sales_order','sales_shipment','sales_invoice',
        'customer_payment'
    ];
    -- These already have created_by — add updated_by only, don't touch created_by.
    has_created_by text[] := ARRAY['company','inventory_movement','inventory_uom'];
BEGIN
    FOREACH t IN ARRAY all_tables LOOP
        -- updated_by on all.
        EXECUTE format(
            'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by uuid', t);
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_'||t||'_updated_by'
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (updated_by)
                 REFERENCES public.profiles(id) ON DELETE SET NULL',
                t, 'fk_'||t||'_updated_by');
        END IF;

        -- created_by only where it does not already exist.
        IF NOT (t = ANY(has_created_by)) THEN
            EXECUTE format(
                'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid', t);
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_'||t||'_created_by'
            ) THEN
                EXECUTE format(
                    'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (created_by)
                     REFERENCES public.profiles(id) ON DELETE SET NULL',
                    t, 'fk_'||t||'_created_by');
            END IF;
        END IF;
    END LOOP;
END $$;

-- ── 2. Backfill created_by from the legacy user_id creator ──────────────────
-- Tables whose legacy creator lives in `user_id`. The rest (warehouse,
-- warehouse_location, company_settings, roles, profiles) have no historical
-- creator → created_by stays NULL and renders as "System" in the UI.
DO $$
DECLARE
    t text;
    from_user_id text[] := ARRAY[
        'inventory_item','inventory_item_category','customer','customer_payment',
        'receipt_transaction','stock_adjustment','sales_order','sales_shipment',
        'sales_invoice','user_role'
    ];
BEGIN
    FOREACH t IN ARRAY from_user_id LOOP
        EXECUTE format(
            'UPDATE public.%I SET created_by = user_id
             WHERE created_by IS NULL AND user_id IS NOT NULL', t);
    END LOOP;
END $$;

-- ── 3. Timestamp normalization ──────────────────────────────────────────────
-- 3a. inventory_item_category is missing created_at entirely.
ALTER TABLE public.inventory_item_category
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 3b. Tables that track updates via legacy `writed_at` (or nothing) get the
--     standard updated_at, backfilled from the best available timestamp, plus
--     the shared fn_set_updated_at trigger to maintain it going forward.
DO $$
DECLARE
    t text;
    need_updated_at text[] := ARRAY[
        'inventory_item','inventory_item_category','profiles','roles','user_role'
    ];
    has_writed_at boolean;
BEGIN
    FOREACH t IN ARRAY need_updated_at LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz', t);

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name=t AND column_name='writed_at'
        ) INTO has_writed_at;

        IF has_writed_at THEN
            EXECUTE format(
                'UPDATE public.%I SET updated_at = coalesce(writed_at, created_at, now())
                 WHERE updated_at IS NULL', t);
        ELSE
            EXECUTE format(
                'UPDATE public.%I SET updated_at = coalesce(created_at, now())
                 WHERE updated_at IS NULL', t);
        END IF;

        EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN updated_at SET DEFAULT now()', t);
        EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN updated_at SET NOT NULL', t);

        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
            'trg_'||t||'_updated_at', t);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at()',
            'trg_'||t||'_updated_at', t);
    END LOOP;
END $$;

-- 3c. Guarantee the updated_at maintenance trigger on EVERY supported table.
-- warehouse / warehouse_location had the column but never got the trigger, so
-- their updated_at never moved — this closes that pre-existing gap too.
DO $$
DECLARE
    t text;
    all_tables text[] := ARRAY[
        'inventory_item','inventory_uom','inventory_item_category','warehouse',
        'warehouse_location','customer','company','company_settings','roles',
        'user_role','profiles','receipt_transaction','stock_adjustment',
        'inventory_movement','sales_order','sales_shipment','sales_invoice',
        'customer_payment'
    ];
BEGIN
    FOREACH t IN ARRAY all_tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
            'trg_'||t||'_updated_at', t);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at()',
            'trg_'||t||'_updated_at', t);
    END LOOP;
END $$;

-- ── 4. Provenance immutability guard (defense-in-depth) ─────────────────────
-- created_by / created_at can never be rewritten by any UPDATE, even a stray or
-- malicious one. Applied AFTER the backfills above so it does not pin the
-- freshly-written created_by values to NULL.
CREATE OR REPLACE FUNCTION public.fn_audit_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t text;
    all_tables text[] := ARRAY[
        'inventory_item','inventory_uom','inventory_item_category','warehouse',
        'warehouse_location','customer','company','company_settings','roles',
        'user_role','profiles','receipt_transaction','stock_adjustment',
        'inventory_movement','sales_order','sales_shipment','sales_invoice',
        'customer_payment'
    ];
BEGIN
    FOREACH t IN ARRAY all_tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
            'trg_'||t||'_audit_guard', t);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.fn_audit_guard()',
            'trg_'||t||'_audit_guard', t);
    END LOOP;
END $$;

-- ── 5. Indexes on created_by for document headers (future "my documents") ───
CREATE INDEX IF NOT EXISTS idx_receipt_transaction_created_by ON public.receipt_transaction (created_by);
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_created_by    ON public.stock_adjustment (created_by);
CREATE INDEX IF NOT EXISTS idx_inventory_movement_created_by  ON public.inventory_movement (created_by);
CREATE INDEX IF NOT EXISTS idx_sales_order_created_by         ON public.sales_order (created_by);
CREATE INDEX IF NOT EXISTS idx_sales_shipment_created_by      ON public.sales_shipment (created_by);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_created_by       ON public.sales_invoice (created_by);
CREATE INDEX IF NOT EXISTS idx_customer_payment_created_by    ON public.customer_payment (created_by);
