-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Inventory Balance Ledger + Receipt Transaction Tables
-- Pattern  : Inventory Balance Ledger with Stock Layer Aging (FIFO)
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- Shared trigger function: auto-refresh updated_at on every UPDATE
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 1. inventory_balances
--    The Summary Bucket: one row per (company, item, warehouse, location).
--    qty_available is a generated column so it is always consistent.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_balances (
    id              BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id      INT           NOT NULL REFERENCES company(id),
    item_id         INT           NOT NULL REFERENCES inventory_item(id),
    warehouse_id    INT           NOT NULL REFERENCES warehouse(id),
    location_id     INT           NOT NULL REFERENCES warehouse_location(id),

    qty_on_hand     NUMERIC(18,6) NOT NULL DEFAULT 0,
    qty_reserved    NUMERIC(18,6) NOT NULL DEFAULT 0,
    -- Derived: always = qty_on_hand - qty_reserved, stored for query performance
    qty_available   NUMERIC(18,6) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,

    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    -- One bucket per unique stock slot per company
    CONSTRAINT uq_inventory_balances_bucket
        UNIQUE (company_id, item_id, warehouse_id, location_id),

    CONSTRAINT chk_qty_on_hand_non_negative
        CHECK (qty_on_hand >= 0),
    CONSTRAINT chk_qty_reserved_non_negative
        CHECK (qty_reserved >= 0),
    CONSTRAINT chk_qty_reserved_lte_on_hand
        CHECK (qty_reserved <= qty_on_hand)
);

CREATE INDEX IF NOT EXISTS idx_inv_balances_item        ON inventory_balances (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_balances_wh_loc      ON inventory_balances (warehouse_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inv_balances_company     ON inventory_balances (company_id);
CREATE INDEX IF NOT EXISTS idx_inv_balances_available   ON inventory_balances (company_id, item_id) WHERE qty_available > 0;

CREATE TRIGGER trg_inventory_balances_updated_at
    BEFORE UPDATE ON inventory_balances
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- 2. inventory_balance_details
--    The Aging Layer: sub-row breakdown per (balance, lot, date) for FIFO.
--    NULLS NOT DISTINCT: treats NULL lot/date as a single "anonymous" layer.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_balance_details (
    id              BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    balance_id      BIGINT        NOT NULL REFERENCES inventory_balances(id) ON DELETE CASCADE,

    lot_number      VARCHAR(100),
    purchased_date  TIMESTAMPTZ,
    qty_on_hand     NUMERIC(18,6) NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    -- One detail layer per (balance, lot, date); NULLs are treated as equal
    CONSTRAINT uq_balance_detail_layer
        UNIQUE NULLS NOT DISTINCT (balance_id, lot_number, purchased_date),

    CONSTRAINT chk_detail_qty_non_negative
        CHECK (qty_on_hand >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_balance_details_balance ON inventory_balance_details (balance_id);

CREATE TRIGGER trg_inventory_balance_details_updated_at
    BEFORE UPDATE ON inventory_balance_details
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- 3. receipt_headers
--    Transaction Document Master: one row per physical receiving event.
--    Status lifecycle: DRAFT → POSTED → (VOID only from DRAFT)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipt_headers (
    id                  BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id          INT           NOT NULL REFERENCES company(id),
    user_id             UUID          REFERENCES auth.users(id),

    reference_no        VARCHAR(50)   NOT NULL,               -- system-generated (RCPT-DD-MM-YYYY HH:MM:SS)
    source_reference_no VARCHAR(100),                         -- external PO / supplier reference
    received_date       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    status              VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    notes               TEXT,

    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_receipt_reference_per_company
        UNIQUE (company_id, reference_no),

    CONSTRAINT chk_receipt_status
        CHECK (status IN ('DRAFT', 'POSTED', 'VOID'))
);

CREATE INDEX IF NOT EXISTS idx_receipt_headers_company    ON receipt_headers (company_id);
CREATE INDEX IF NOT EXISTS idx_receipt_headers_status     ON receipt_headers (company_id, status);
CREATE INDEX IF NOT EXISTS idx_receipt_headers_received   ON receipt_headers (received_date DESC);

CREATE TRIGGER trg_receipt_headers_updated_at
    BEFORE UPDATE ON receipt_headers
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- 4. receipt_lines
--    Transaction Lines: one row per item/location in a receipt.
--    base_qty_received is generated: receipt_qty × conversion_factor.
--    Both qty columns are snapshotted at transaction time (immutable history).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipt_lines (
    id                  BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    receipt_id          BIGINT        NOT NULL REFERENCES receipt_headers(id) ON DELETE CASCADE,
    item_id             INT           NOT NULL REFERENCES inventory_item(id),
    warehouse_id        INT           NOT NULL REFERENCES warehouse(id),
    location_id         INT           NOT NULL REFERENCES warehouse_location(id),
    uom_id              INT           NOT NULL REFERENCES inventory_uom(id),
    item_uom_id         INT           REFERENCES inventory_item_uom(id),   -- source of conversion_factor

    -- Quantity snapshot: receipt_qty × conversion_factor = base_qty_received
    receipt_qty         NUMERIC(18,6) NOT NULL,
    conversion_factor   NUMERIC(18,6) NOT NULL DEFAULT 1,                  -- snapshot at transaction time
    base_qty_received   NUMERIC(18,6) GENERATED ALWAYS AS (receipt_qty * conversion_factor) STORED,

    -- Batch / FIFO attributes (mirrored into inventory_balance_details on POST)
    lot_number          VARCHAR(100),
    purchased_date      TIMESTAMPTZ,

    unit_cost           NUMERIC(18,6),                                     -- cost snapshot for valuation

    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_receipt_qty_positive
        CHECK (receipt_qty > 0),
    CONSTRAINT chk_conversion_factor_positive
        CHECK (conversion_factor > 0)
);

CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt  ON receipt_lines (receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_item     ON receipt_lines (item_id);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_wh_loc   ON receipt_lines (warehouse_id, location_id);

CREATE TRIGGER trg_receipt_lines_updated_at
    BEFORE UPDATE ON receipt_lines
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- Atomic Posting RPC Function
-- Called via: supabase.rpc('post_inventory_receipt', { p_receipt_id, p_company_id })
--
-- Flow:
--   1. Lock the receipt header row (prevents concurrent double-posts)
--   2. Validate status is DRAFT
--   3. For each receipt line:
--        a. UPSERT inventory_balances   → adds base_qty_received to qty_on_hand
--        b. UPSERT inventory_balance_details → adds to the matching lot/date layer
--   4. Mark receipt_headers.status = 'POSTED'
--   5. Any failure auto-rolls back the entire transaction
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION post_inventory_receipt(
    p_receipt_id  BIGINT,
    p_company_id  INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_status     TEXT;
    v_line       RECORD;
    v_balance_id BIGINT;
BEGIN
    -- Lock the header to prevent concurrent posts of the same receipt
    SELECT status INTO v_status
    FROM receipt_headers
    WHERE id = p_receipt_id
      AND company_id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Receipt not found');
    END IF;

    IF v_status <> 'DRAFT' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', format('Cannot post a receipt with status "%s"', v_status)
        );
    END IF;

    -- Iterate every line and apply inventory movements
    FOR v_line IN
        SELECT * FROM receipt_lines WHERE receipt_id = p_receipt_id
    LOOP
        -- Step A: UPSERT the summary bucket
        INSERT INTO inventory_balances
            (company_id, item_id, warehouse_id, location_id, qty_on_hand, qty_reserved)
        VALUES
            (p_company_id, v_line.item_id, v_line.warehouse_id, v_line.location_id,
             v_line.base_qty_received, 0)
        ON CONFLICT (company_id, item_id, warehouse_id, location_id)
        DO UPDATE SET
            qty_on_hand = inventory_balances.qty_on_hand + EXCLUDED.qty_on_hand,
            updated_at  = NOW()
        RETURNING id INTO v_balance_id;

        -- Step B: UPSERT the aging/FIFO layer
        INSERT INTO inventory_balance_details
            (balance_id, lot_number, purchased_date, qty_on_hand)
        VALUES
            (v_balance_id, v_line.lot_number, v_line.purchased_date, v_line.base_qty_received)
        ON CONFLICT (balance_id, lot_number, purchased_date)
        DO UPDATE SET
            qty_on_hand = inventory_balance_details.qty_on_hand + EXCLUDED.qty_on_hand,
            updated_at  = NOW();
    END LOOP;

    -- Mark the receipt as POSTED
    UPDATE receipt_headers
    SET status     = 'POSTED',
        updated_at = NOW()
    WHERE id = p_receipt_id;

    RETURN jsonb_build_object('ok', true, 'receipt_id', p_receipt_id);

EXCEPTION WHEN OTHERS THEN
    -- PostgreSQL auto-rolls back on any unhandled exception
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
