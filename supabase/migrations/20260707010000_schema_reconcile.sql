-- ═══════════════════════════════════════════════════════════════════════════
-- Schema reconcile — converge the long-lived dev database to the repaired
-- migration history (production-readiness cleanup, 2026-07-07).
--
-- Context: receipt tables were renamed by hand (receipt_headers →
-- receipt_transaction, receipt_lines → receipt_items) leaving old physical
-- names on triggers/constraints/sequences/indexes; a typo view and a broken
-- function survived; modules lost its UNIQUE(key).
--
-- Idempotent and metadata-only: no rows are read or written. On a fresh
-- replay of the repaired history everything below is a no-op.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Dead objects ─────────────────────────────────────────────────────────

-- Typo twin of user_profiles_view; zero code references.
DROP VIEW IF EXISTS public.user_profils;

-- Broken since the manual rename (body still queries receipt_headers) and
-- never called from code — posting goes through the movement ledger.
DROP FUNCTION IF EXISTS public.post_inventory_receipt(BIGINT, INT);

-- Superseded by inventory_balances (movement ledger). Dropped manually from
-- the live DB long ago; guard covers any environment that still has it.
DROP TABLE IF EXISTS public.inventory_item_balance CASCADE;

-- ── 2. Rename stale physical names from the manual receipt rename ───────────

DO $$
BEGIN
    -- Triggers
    IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
               WHERE t.tgname = 'trg_receipt_headers_updated_at'
                 AND c.relname = 'receipt_transaction') THEN
        ALTER TRIGGER trg_receipt_headers_updated_at ON public.receipt_transaction
            RENAME TO trg_receipt_transaction_updated_at;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
               WHERE t.tgname = 'trg_receipt_lines_updated_at'
                 AND c.relname = 'receipt_items') THEN
        ALTER TRIGGER trg_receipt_lines_updated_at ON public.receipt_items
            RENAME TO trg_receipt_items_updated_at;
    END IF;

    -- Constraints (renaming a PK constraint renames its index too)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'receipt_headers_pkey') THEN
        ALTER TABLE public.receipt_transaction RENAME CONSTRAINT receipt_headers_pkey            TO receipt_transaction_pkey;
        ALTER TABLE public.receipt_transaction RENAME CONSTRAINT receipt_headers_company_id_fkey TO receipt_transaction_company_id_fkey;
        ALTER TABLE public.receipt_items RENAME CONSTRAINT receipt_lines_pkey              TO receipt_items_pkey;
        ALTER TABLE public.receipt_items RENAME CONSTRAINT receipt_lines_receipt_id_fkey   TO receipt_items_receipt_id_fkey;
        ALTER TABLE public.receipt_items RENAME CONSTRAINT receipt_lines_item_id_fkey      TO receipt_items_item_id_fkey;
        ALTER TABLE public.receipt_items RENAME CONSTRAINT receipt_lines_item_uom_id_fkey  TO receipt_items_item_uom_id_fkey;
        ALTER TABLE public.receipt_items RENAME CONSTRAINT receipt_lines_location_id_fkey  TO receipt_items_location_id_fkey;
        ALTER TABLE public.receipt_items RENAME CONSTRAINT receipt_lines_warehouse_id_fkey TO receipt_items_warehouse_id_fkey;
    END IF;

    -- Indexes
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_receipt_headers_company') THEN
        ALTER INDEX public.idx_receipt_headers_company RENAME TO idx_receipt_transaction_company;
        ALTER INDEX public.idx_receipt_headers_status  RENAME TO idx_receipt_transaction_status;
        ALTER INDEX public.idx_receipt_lines_receipt   RENAME TO idx_receipt_items_receipt;
        ALTER INDEX public.idx_receipt_lines_item      RENAME TO idx_receipt_items_item;
        ALTER INDEX public.idx_receipt_lines_wh_loc    RENAME TO idx_receipt_items_wh_loc;
    END IF;

    -- Identity sequences
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'receipt_headers_id_seq') THEN
        ALTER SEQUENCE public.receipt_headers_id_seq RENAME TO receipt_transaction_id_seq;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'receipt_lines_id_seq') THEN
        ALTER SEQUENCE public.receipt_lines_id_seq RENAME TO receipt_items_id_seq;
    END IF;
END $$;

-- ── 3. Restore integrity constraints lost to manual edits ───────────────────

-- modules.key uniqueness (verified: no duplicates exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'modules_key_key') THEN
        ALTER TABLE public.modules ADD CONSTRAINT modules_key_key UNIQUE (key);
    END IF;
END $$;
