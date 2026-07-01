-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Sales Module — Sales Order + Sales Shipment
-- Pattern  : Document master/lines mirroring the Inventory Receipt module.
--            Stock is only touched when a Shipment is POSTED, via the shared
--            inventory movement engine (no direct balance writes here).
-- Reuses    : fn_set_updated_at() (created in the receipt-ledger migration).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- 1. sales_order
--    Header master. Progress lifecycle driven by shipped vs ordered qty:
--    open → partial_shipment → closed  (or cancelled).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_order (
    id                      BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id              INT           NOT NULL REFERENCES company(id),
    user_id                 UUID          REFERENCES profiles(id),

    order_no                VARCHAR(50)   NOT NULL,           -- system-generated (SO-DD-MM-YYYY HH:MM:SS)
    customer_name           VARCHAR(200)  NOT NULL,
    customer_phone          VARCHAR(50),
    order_date              DATE          NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date  DATE,
    warehouse_id            INT           NOT NULL REFERENCES warehouse(id),
    currency                VARCHAR(10)   NOT NULL DEFAULT 'USD',
    status                  VARCHAR(20)   NOT NULL DEFAULT 'open',

    subtotal                NUMERIC(18,6) NOT NULL DEFAULT 0,
    discount_total          NUMERIC(18,6) NOT NULL DEFAULT 0,
    tax_total               NUMERIC(18,6) NOT NULL DEFAULT 0,
    grand_total             NUMERIC(18,6) NOT NULL DEFAULT 0,
    notes                   TEXT,

    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_sales_order_no_per_company
        UNIQUE (company_id, order_no),
    CONSTRAINT chk_sales_order_status
        CHECK (status IN ('open', 'partial_shipment', 'closed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_sales_order_company ON sales_order (company_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_status  ON sales_order (company_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_order_date    ON sales_order (order_date DESC);

CREATE TRIGGER trg_sales_order_updated_at
    BEFORE UPDATE ON sales_order
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- 2. sales_order_items
--    Order lines. shipped_qty accrues as shipments are POSTED.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_order_items (
    id            BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id      BIGINT        NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
    company_id    INT           NOT NULL REFERENCES company(id),
    item_id       INT           NOT NULL REFERENCES inventory_item(id),
    item_uom_id   INT           REFERENCES inventory_item_uom(id),

    description   TEXT,
    uom           VARCHAR(50),
    ordered_qty   NUMERIC(18,6) NOT NULL,
    shipped_qty   NUMERIC(18,6) NOT NULL DEFAULT 0,
    unit_price    NUMERIC(18,6) NOT NULL DEFAULT 0,
    discount      NUMERIC(9,4)  NOT NULL DEFAULT 0,   -- percent
    tax           NUMERIC(9,4)  NOT NULL DEFAULT 0,   -- percent
    line_total    NUMERIC(18,6) NOT NULL DEFAULT 0,

    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_so_item_ordered_positive CHECK (ordered_qty > 0),
    CONSTRAINT chk_so_item_shipped_range    CHECK (shipped_qty >= 0 AND shipped_qty <= ordered_qty)
);

CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON sales_order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_item  ON sales_order_items (item_id);

CREATE TRIGGER trg_sales_order_items_updated_at
    BEFORE UPDATE ON sales_order_items
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- 3. sales_shipment
--    Shipment (delivery note) header. Status: DRAFT → POSTED → (VOID from DRAFT).
--    POST writes an OUT inventory movement; POSTED is immutable.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_shipment (
    id                BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id        INT           NOT NULL REFERENCES company(id),
    user_id           UUID          REFERENCES profiles(id),

    shipment_no       VARCHAR(50)   NOT NULL,                 -- system-generated (SH-DD-MM-YYYY HH:MM:SS)
    sales_order_id    BIGINT        NOT NULL REFERENCES sales_order(id),
    customer_name     VARCHAR(200),
    delivery_date     DATE          NOT NULL DEFAULT CURRENT_DATE,
    warehouse_id      INT           NOT NULL REFERENCES warehouse(id),
    status            VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    receiver_name     VARCHAR(200),
    delivery_address  TEXT,
    notes             TEXT,

    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_sales_shipment_no_per_company
        UNIQUE (company_id, shipment_no),
    CONSTRAINT chk_sales_shipment_status
        CHECK (status IN ('DRAFT', 'POSTED', 'VOID'))
);

CREATE INDEX IF NOT EXISTS idx_sales_shipment_company ON sales_shipment (company_id);
CREATE INDEX IF NOT EXISTS idx_sales_shipment_status  ON sales_shipment (company_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_shipment_order   ON sales_shipment (sales_order_id);

CREATE TRIGGER trg_sales_shipment_updated_at
    BEFORE UPDATE ON sales_shipment
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- 4. sales_shipment_items
--    Shipment lines. Each references the originating order line + a stock
--    location and item UOM (needed to build the inventory movement on POST).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_shipment_items (
    id                      BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shipment_id             BIGINT        NOT NULL REFERENCES sales_shipment(id) ON DELETE CASCADE,
    company_id              INT           NOT NULL REFERENCES company(id),
    sales_order_item_id     BIGINT        NOT NULL REFERENCES sales_order_items(id),
    item_id                 INT           NOT NULL REFERENCES inventory_item(id),
    location_id             INT           NOT NULL REFERENCES warehouse_location(id),
    item_uom_id             INT           REFERENCES inventory_item_uom(id),

    ordered_qty             NUMERIC(18,6) NOT NULL DEFAULT 0,
    previously_shipped_qty  NUMERIC(18,6) NOT NULL DEFAULT 0,
    shipment_qty            NUMERIC(18,6) NOT NULL,

    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_shipment_qty_positive CHECK (shipment_qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_shipment_items_shipment ON sales_shipment_items (shipment_id);
CREATE INDEX IF NOT EXISTS idx_sales_shipment_items_so_item  ON sales_shipment_items (sales_order_item_id);
CREATE INDEX IF NOT EXISTS idx_sales_shipment_items_item     ON sales_shipment_items (item_id);

CREATE TRIGGER trg_sales_shipment_items_updated_at
    BEFORE UPDATE ON sales_shipment_items
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
