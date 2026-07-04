-- ═══════════════════════════════════════════════════════════════════════════
-- Document Numbering & Reference Number framework.
--   • document_sequence: per company × doc_type counter with prefix/padding/
--     reset rule — configuration is DATA (future Company Settings edits rows).
--   • next_document_number(): auto-seeds, then a single atomic
--     UPDATE … RETURNING. The row lock serializes concurrent callers, so
--     numbers are unique and gap-free with no app-level locking.
--   • Reference Number = user-entered, never generated: reference_no on the
--     sales documents; source_reference_no on receipts (whose reference_no is
--     already the system number).
-- Replaces the timestamp-based generator (same-second collisions, not
-- sequential) for business documents.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Sequence configuration + counters ────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_sequence (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id  INT         NOT NULL REFERENCES company(id),
    doc_type    VARCHAR(30) NOT NULL,
    prefix      VARCHAR(10) NOT NULL,
    padding     INT         NOT NULL DEFAULT 6,
    reset_rule  VARCHAR(10) NOT NULL DEFAULT 'never',   -- never | yearly
    period_key  VARCHAR(10) NOT NULL DEFAULT '',
    next_value  BIGINT      NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_document_sequence UNIQUE (company_id, doc_type),
    CONSTRAINT chk_document_sequence_reset CHECK (reset_rule IN ('never', 'yearly'))
);

DROP TRIGGER IF EXISTS trg_document_sequence_updated_at ON document_sequence;
CREATE TRIGGER trg_document_sequence_updated_at
    BEFORE UPDATE ON document_sequence
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 2. Atomic number generator ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION next_document_number(
    p_company_id     INT,
    p_doc_type       VARCHAR,
    p_default_prefix VARCHAR DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_year   VARCHAR := to_char(NOW(), 'YYYY');
    v_number TEXT;
BEGIN
    -- Auto-seed: a brand-new module's first call creates its sequence row —
    -- no migration required per module.
    INSERT INTO document_sequence (company_id, doc_type, prefix)
    VALUES (p_company_id, p_doc_type, COALESCE(p_default_prefix, upper(p_doc_type)))
    ON CONFLICT (company_id, doc_type) DO NOTHING;

    -- Atomic take-a-number. The row lock serializes concurrent callers; the
    -- yearly reset is decided inside the same UPDATE so it is atomic too.
    UPDATE document_sequence
    SET next_value = CASE
            WHEN reset_rule = 'yearly' AND period_key <> v_year THEN 2
            ELSE next_value + 1
        END,
        period_key = CASE
            WHEN reset_rule = 'yearly' THEN v_year
            ELSE period_key
        END
    WHERE company_id = p_company_id AND doc_type = p_doc_type
    RETURNING prefix || '-' ||
              CASE WHEN reset_rule = 'yearly' THEN period_key || '-' ELSE '' END ||
              lpad((CASE
                  WHEN reset_rule = 'yearly' AND next_value = 2 THEN 1
                  ELSE next_value - 1
              END)::text, padding, '0')
    INTO v_number;

    RETURN v_number;
END;
$$;

-- ── 3. Seed sequences for existing companies (prefixes per spec) ────────────
INSERT INTO document_sequence (company_id, doc_type, prefix)
SELECT c.id, d.doc_type, d.prefix
FROM company c
CROSS JOIN (VALUES
    ('sales_order',        'SO'),
    ('sales_shipment',     'SHP'),
    ('sales_invoice',      'INV'),
    ('inventory_receipt',  'RCT'),
    ('inventory_movement', 'MOV')
) AS d(doc_type, prefix)
ON CONFLICT (company_id, doc_type) DO NOTHING;

-- ── 4. User-entered Reference Number columns ────────────────────────────────
ALTER TABLE sales_order        ADD COLUMN IF NOT EXISTS reference_no        VARCHAR(100);
ALTER TABLE sales_shipment     ADD COLUMN IF NOT EXISTS reference_no        VARCHAR(100);
ALTER TABLE sales_invoice      ADD COLUMN IF NOT EXISTS reference_no        VARCHAR(100);
ALTER TABLE receipt_transaction ADD COLUMN IF NOT EXISTS source_reference_no VARCHAR(100);
