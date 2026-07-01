-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Inventory Movement Ledger
-- Purpose  : Central inventory ledger. EVERY stock quantity change (receipt,
--            issue, transfer, adjustment, return, opening balance, ...) first
--            records an inventory_movement, and stock balances are derived from
--            these movements. Movements are the single source of truth.
--
-- Flow     : Source Document  →  Inventory Movement  →  Inventory Stock Balance
--
-- Note     : reuses fn_set_updated_at() created in the receipt-ledger migration.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- 1. inventory_movement
--    Header: one row per inventory transaction event. Never stores business
--    data (supplier/customer) — only the fact that stock moved.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movement (
    id                    BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id            INT           NOT NULL REFERENCES company(id),
    created_by            UUID          REFERENCES profiles(id),

    reference_no          VARCHAR(50)   NOT NULL,
    movement_date         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    movement_type         VARCHAR(30)   NOT NULL,   -- receipt | issue | transfer | adjustment | return | opening_balance ...

    -- Traceability back to the originating business document
    source_module         VARCHAR(50)   NOT NULL,   -- inventory | sales | purchase | manufacturing ...
    source_document_type  VARCHAR(50),              -- receipt | issue | transfer | adjustment ...
    source_document_id    BIGINT,                   -- id of the source document (e.g. receipt_transaction.id)

    status                VARCHAR(20)   NOT NULL DEFAULT 'POSTED',
    remarks               TEXT,

    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_inventory_movement_reference_per_company
        UNIQUE (company_id, reference_no),

    CONSTRAINT chk_inventory_movement_status
        CHECK (status IN ('DRAFT', 'POSTED', 'VOID'))
);

CREATE INDEX IF NOT EXISTS idx_inv_movement_company  ON inventory_movement (company_id);
CREATE INDEX IF NOT EXISTS idx_inv_movement_date     ON inventory_movement (movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_inv_movement_source   ON inventory_movement (source_module, source_document_type, source_document_id);

CREATE TRIGGER trg_inventory_movement_updated_at
    BEFORE UPDATE ON inventory_movement
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- 2. inventory_movement_items
--    Detail: one row per item/location movement. Quantities are snapshotted in
--    BOTH the entered UOM and the item's base UOM. Stock balance is always
--    driven by base_qty so every module stays consistent.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movement_items (
    id                  BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    movement_id         BIGINT        NOT NULL REFERENCES inventory_movement(id) ON DELETE CASCADE,
    company_id          INT           NOT NULL REFERENCES company(id),

    item_id             INT           NOT NULL REFERENCES inventory_item(id),
    warehouse_id        INT           NOT NULL REFERENCES warehouse(id),
    location_id         INT           NOT NULL REFERENCES warehouse_location(id),

    -- Quantity as the user entered it
    entered_qty         NUMERIC(18,6) NOT NULL,
    entered_uom_id      INT           REFERENCES inventory_uom(id),

    -- Same quantity normalised to the item base UOM (what balances are kept in)
    base_qty            NUMERIC(18,6) NOT NULL,
    base_uom_id         INT           REFERENCES inventory_uom(id),

    movement_direction  VARCHAR(3)    NOT NULL,     -- IN | OUT

    unit_cost           NUMERIC(18,6),
    total_cost          NUMERIC(18,6) GENERATED ALWAYS AS (base_qty * COALESCE(unit_cost, 0)) STORED,

    -- Batch / FIFO attributes (mirrored into inventory_balance_details for IN)
    lot_number          VARCHAR(100),
    purchased_date      TIMESTAMPTZ,

    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_inv_movement_item_direction
        CHECK (movement_direction IN ('IN', 'OUT')),
    CONSTRAINT chk_inv_movement_item_base_qty_positive
        CHECK (base_qty > 0),
    CONSTRAINT chk_inv_movement_item_entered_qty_positive
        CHECK (entered_qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_movement_items_movement ON inventory_movement_items (movement_id);
CREATE INDEX IF NOT EXISTS idx_inv_movement_items_item     ON inventory_movement_items (company_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inv_movement_items_wh_loc   ON inventory_movement_items (warehouse_id, location_id);
