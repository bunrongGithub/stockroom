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
-- 3. receipt_transaction
--    Transaction Document Master: one row per physical receiving event.
--    Status lifecycle: DRAFT → POSTED → (VOID only from DRAFT)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipt_transaction (
    id                  BIGINT        GENERATED ALWAYS AS IDENTITY,
    company_id          INT           NOT NULL,
    user_id             UUID,

    reference_no        VARCHAR(50)   NOT NULL,               -- system-generated document number
    status              VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    notes               TEXT,

    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    transaction_date    DATE          NOT NULL,
    movement_type       TEXT,
    reason              TEXT,
    source_reference_no VARCHAR(100),                         -- external PO / supplier reference

    CONSTRAINT receipt_transaction_pkey
        PRIMARY KEY (id),
    CONSTRAINT receipt_transaction_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES company(id),
    CONSTRAINT receipt_transaction_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES profiles(id),

    CONSTRAINT uq_receipt_reference_per_company
        UNIQUE (company_id, reference_no),

    CONSTRAINT chk_receipt_status
        CHECK (status IN ('DRAFT', 'POSTED', 'VOID'))
);

CREATE INDEX IF NOT EXISTS idx_receipt_transaction_company ON receipt_transaction (company_id);
CREATE INDEX IF NOT EXISTS idx_receipt_transaction_status  ON receipt_transaction (company_id, status);

CREATE TRIGGER trg_receipt_transaction_updated_at
    BEFORE UPDATE ON receipt_transaction
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- 4. receipt_items
--    Transaction Lines: one row per item/location in a receipt.
--    base_qty_received is generated: receipt_qty × conversion_factor.
--    Both qty columns are snapshotted at transaction time (immutable history).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipt_items (
    id                  BIGINT        GENERATED ALWAYS AS IDENTITY,
    receipt_id          BIGINT        NOT NULL,
    item_id             INT           NOT NULL,
    warehouse_id        INT           NOT NULL,
    location_id         INT           NOT NULL,
    item_uom_id         INT,                                               -- source of conversion_factor

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

    CONSTRAINT receipt_items_pkey
        PRIMARY KEY (id),
    CONSTRAINT receipt_items_receipt_id_fkey
        FOREIGN KEY (receipt_id) REFERENCES receipt_transaction(id) ON DELETE CASCADE,
    CONSTRAINT receipt_items_item_id_fkey
        FOREIGN KEY (item_id) REFERENCES inventory_item(id),
    CONSTRAINT receipt_items_warehouse_id_fkey
        FOREIGN KEY (warehouse_id) REFERENCES warehouse(id),
    CONSTRAINT receipt_items_location_id_fkey
        FOREIGN KEY (location_id) REFERENCES warehouse_location(id),
    CONSTRAINT receipt_items_item_uom_id_fkey
        FOREIGN KEY (item_uom_id) REFERENCES inventory_item_uom(id),

    CONSTRAINT chk_receipt_qty_positive
        CHECK (receipt_qty > 0),
    CONSTRAINT chk_conversion_factor_positive
        CHECK (conversion_factor > 0)
);

CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items (receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_item    ON receipt_items (item_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_wh_loc  ON receipt_items (warehouse_id, location_id);

CREATE TRIGGER trg_receipt_items_updated_at
    BEFORE UPDATE ON receipt_items
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- NOTE: the former `post_inventory_receipt()` RPC was removed — posting is
-- done by the application service layer through the movement ledger
-- (20260701000000); the function was never called from code.
