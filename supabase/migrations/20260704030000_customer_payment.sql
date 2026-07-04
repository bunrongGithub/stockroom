-- ═══════════════════════════════════════════════════════════════════════════
-- Customer Payment module + reusable Allocation framework.
--   • customer_payment: financial document that settles outstanding invoices.
--     NEVER touches inventory, NEVER changes invoice totals.
--   • document_allocation: POLYMORPHIC settlement table (source → target). A
--     payment allocates to invoices today; future Credit Notes / Refunds insert
--     rows with a new source_type against the same invoices — no schema change.
--   • sales_invoice.amount_paid: denormalized cache = SUM of allocations from
--     POSTED payments. Source of truth stays document_allocation; the cache is
--     recomputed atomically on post/cancel (mirrors the shipment→invoice
--     recompute pattern) so invoice LISTS never need a join.
-- Invoice PAYMENT status (UNPAID / PARTIALLY_PAID / PAID) is DERIVED from
-- amount_paid vs grand_total — independent of the invoice DOCUMENT status.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Payment header ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_payment (
    id             BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id     INT           NOT NULL REFERENCES company(id),
    user_id        UUID          REFERENCES profiles(id),
    payment_no     VARCHAR(30)   NOT NULL,
    reference_no   VARCHAR(100),                       -- user-entered (bank txn / cheque no)
    payment_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
    customer_name  VARCHAR(255)  NOT NULL,
    customer_phone VARCHAR(50),
    payment_method VARCHAR(20)   NOT NULL DEFAULT 'CASH',
    currency       VARCHAR(10)   NOT NULL DEFAULT 'USD',
    amount         NUMERIC(18,6) NOT NULL DEFAULT 0,   -- total tendered
    status         VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    remarks        TEXT,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_customer_payment_no_per_company UNIQUE (company_id, payment_no),
    CONSTRAINT chk_customer_payment_status CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    CONSTRAINT chk_customer_payment_method CHECK (
        payment_method IN ('CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_customer_payment_company  ON customer_payment (company_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_status   ON customer_payment (company_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_payment_customer ON customer_payment (company_id, customer_name);

DROP TRIGGER IF EXISTS trg_customer_payment_updated_at ON customer_payment;
CREATE TRIGGER trg_customer_payment_updated_at
    BEFORE UPDATE ON customer_payment
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 2. Reusable allocation framework ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_allocation (
    id          BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id  INT           NOT NULL REFERENCES company(id),
    source_type VARCHAR(30)   NOT NULL,                -- 'customer_payment' (future: credit_note…)
    source_id   BIGINT        NOT NULL,
    target_type VARCHAR(30)   NOT NULL,                -- 'sales_invoice'
    target_id   BIGINT        NOT NULL,
    amount      NUMERIC(18,6) NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_document_allocation_amount CHECK (amount > 0)
);

-- "who settled this invoice" (payments tab, amount_paid recompute)
CREATE INDEX IF NOT EXISTS idx_document_allocation_target
    ON document_allocation (target_type, target_id);
-- "what did this payment settle" (payment detail)
CREATE INDEX IF NOT EXISTS idx_document_allocation_source
    ON document_allocation (source_type, source_id);

-- ── 3. Denormalized paid cache on the invoice ────────────────────────────────
ALTER TABLE sales_invoice ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(18,6) NOT NULL DEFAULT 0;

-- ── 4. Module rows: /sale/payment (list) + create + view ─────────────────────
INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/sale/payment', 'Payment', '/sale/payment', 'SalePayment',
       (SELECT parent_id FROM modules WHERE path = '/sale/invoice'),
       'transaction', 4, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/sale/payment');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/sale/payment/create', 'Create', '/sale/payment/create', 'SalePaymentCreate',
       (SELECT id FROM modules WHERE path = '/sale/payment'), 'action', 1, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/sale/payment/create');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/sale/payment/:id/view', 'View', '/sale/payment/:id/view', 'SalePaymentDetail',
       (SELECT id FROM modules WHERE path = '/sale/payment'), 'action', 2, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/sale/payment/:id/view');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/sale/payment/:id/update', 'Update', '/sale/payment/:id/update', 'SalePaymentUpdate',
       (SELECT id FROM modules WHERE path = '/sale/payment'), 'action', 3, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/sale/payment/:id/update');

-- ── 5. Copy each invoice module's role permissions to the payment equivalent ──
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id
JOIN modules dst ON dst.path = replace(src.path, '/sale/invoice', '/sale/payment')
WHERE src.path IN (
    '/sale/invoice',
    '/sale/invoice/create',
    '/sale/invoice/:id/view',
    '/sale/invoice/:id/update'
)
ON CONFLICT (role_id, module_id) DO NOTHING;
