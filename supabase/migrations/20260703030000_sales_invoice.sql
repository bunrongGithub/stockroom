-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Sales Invoice (billing document created from a POSTED shipment).
-- Never touches inventory. Snapshots customer + line pricing for audit trail.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. sales_invoice (header) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_invoice (
    id              BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id      INT           NOT NULL REFERENCES company(id),
    user_id         UUID          REFERENCES profiles(id),

    invoice_no      VARCHAR(50)   NOT NULL,                 -- INV-DD-MM-YYYY HH:MM:SS
    shipment_id     BIGINT        NOT NULL REFERENCES sales_shipment(id),
    sales_order_id  BIGINT        REFERENCES sales_order(id),

    customer_name   VARCHAR(200),
    customer_phone  VARCHAR(50),
    customer_address TEXT,

    invoice_date    DATE          NOT NULL DEFAULT CURRENT_DATE,
    currency        VARCHAR(10)   NOT NULL DEFAULT 'USD',
    exchange_rate   NUMERIC(18,6) NOT NULL DEFAULT 1,
    status          VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',

    subtotal        NUMERIC(18,6) NOT NULL DEFAULT 0,
    discount_total  NUMERIC(18,6) NOT NULL DEFAULT 0,
    tax_total       NUMERIC(18,6) NOT NULL DEFAULT 0,
    grand_total     NUMERIC(18,6) NOT NULL DEFAULT 0,
    remarks         TEXT,

    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_sales_invoice_no_per_company UNIQUE (company_id, invoice_no),
    CONSTRAINT chk_sales_invoice_status CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_company  ON sales_invoice (company_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_status   ON sales_invoice (company_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_shipment ON sales_invoice (shipment_id);

DROP TRIGGER IF EXISTS trg_sales_invoice_updated_at ON sales_invoice;
CREATE TRIGGER trg_sales_invoice_updated_at
    BEFORE UPDATE ON sales_invoice
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 2. sales_invoice_items (lines — pricing snapshot) ────────────────────────
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id                   BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id           BIGINT        NOT NULL REFERENCES sales_invoice(id) ON DELETE CASCADE,
    company_id           INT           NOT NULL REFERENCES company(id),
    item_id              INT           NOT NULL REFERENCES inventory_item(id),
    sales_order_item_id  BIGINT        REFERENCES sales_order_items(id),
    shipment_item_id     BIGINT        REFERENCES sales_shipment_items(id),

    description          TEXT,
    uom                  VARCHAR(50),
    quantity             NUMERIC(18,6) NOT NULL,
    unit_price           NUMERIC(18,6) NOT NULL DEFAULT 0,
    discount             NUMERIC(9,4)  NOT NULL DEFAULT 0,   -- percent
    tax                  NUMERIC(9,4)  NOT NULL DEFAULT 0,   -- percent
    line_total           NUMERIC(18,6) NOT NULL DEFAULT 0,

    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sales_invoice_item_qty CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice ON sales_invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_item    ON sales_invoice_items (item_id);

DROP TRIGGER IF EXISTS trg_sales_invoice_items_updated_at ON sales_invoice_items;
CREATE TRIGGER trg_sales_invoice_items_updated_at
    BEFORE UPDATE ON sales_invoice_items
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 3. Shipment gains an INVOICED state ──────────────────────────────────────
ALTER TABLE sales_shipment DROP CONSTRAINT IF EXISTS chk_sales_shipment_status;
ALTER TABLE sales_shipment ADD CONSTRAINT chk_sales_shipment_status
    CHECK (status IN ('DRAFT', 'POSTED', 'VOID', 'INVOICED'));

-- ── 4. Navigation module rows (mirror the shipment rows) ─────────────────────
INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/sale/invoice', 'Invoice', '/sale/invoice', 'SaleInvoice',
       (SELECT parent_id FROM modules WHERE path = '/sale/delivery-note'),
       'transaction', 3, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/sale/invoice');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/sale/invoice/create', 'Create', '/sale/invoice/create', 'SaleInvoiceCreate',
       (SELECT id FROM modules WHERE path = '/sale/invoice'), 'action', 1, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/sale/invoice/create');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/sale/invoice/:id/view', 'View', '/sale/invoice/:id/view', 'SaleInvoiceDetail',
       (SELECT id FROM modules WHERE path = '/sale/invoice'), 'action', 2, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/sale/invoice/:id/view');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/sale/invoice/:id/update', 'Update', '/sale/invoice/:id/update', 'SaleInvoiceUpdate',
       (SELECT id FROM modules WHERE path = '/sale/invoice'), 'action', 3, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/sale/invoice/:id/update');

-- ── 5. Copy each shipment module's role permissions to the invoice equivalent ─
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id
JOIN modules dst ON dst.path = replace(src.path, '/sale/delivery-note', '/sale/invoice')
WHERE src.path IN (
    '/sale/delivery-note',
    '/sale/delivery-note/create',
    '/sale/delivery-note/:id/view',
    '/sale/delivery-note/:id/update'
)
ON CONFLICT (role_id, module_id) DO NOTHING;
