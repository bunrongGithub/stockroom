-- Outstanding balance as a STORED generated column so the allocation grid can
-- filter "has a balance" server-side (PostgREST cannot compare two columns).
-- Recomputes automatically whenever grand_total or amount_paid changes.
ALTER TABLE sales_invoice
    ADD COLUMN IF NOT EXISTS outstanding NUMERIC(18,6)
    GENERATED ALWAYS AS (grand_total - amount_paid) STORED;

-- Partial index: the "still owed" set, oldest-first, per company.
CREATE INDEX IF NOT EXISTS idx_sales_invoice_outstanding
    ON sales_invoice (company_id, id)
    WHERE outstanding > 0;
