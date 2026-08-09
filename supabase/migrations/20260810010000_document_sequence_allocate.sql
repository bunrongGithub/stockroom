-- ═══════════════════════════════════════════════════════════════════════════
-- Separate ALLOCATION from FORMATTING.
--
-- next_document_number() did both in one statement: it took the next counter
-- value and rendered the string from a hardcoded shape. That coupling is what
-- made a configurable format impossible, and what would have forced the
-- settings screen to reimplement rendering just to show a preview — two
-- implementations of the same rule, guaranteed to drift.
--
-- After this migration:
--   allocate_document_number()  takes a number, atomically. Returns the raw
--                               counter plus the row's config. Formats nothing.
--   render_document_number()    pure. Renders a template. Allocates nothing.
--   next_document_number()      kept, reimplemented over the two above, because
--                               20260721010000_master_data_business_partner.sql
--                               calls it from SQL and replay must still work.
--
-- The application calls allocate_document_number() and renders in TypeScript
-- (service/core/document-format.ts), so the settings preview and live
-- generation share one implementation. render_document_number() mirrors it for
-- SQL callers; tests/document-sequence-db.test.mjs asserts the two agree.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. The period a reset rule counts within ────────────────────────────────
-- Computed from the DATABASE clock, deliberately: allocation happens here, and
-- a browser in another timezone must not decide which year a document is in.
-- Mirrors periodKeyFor() in service/core/document-format.ts.
CREATE OR REPLACE FUNCTION public.document_period_key(
    p_reset_rule VARCHAR,
    p_at         TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_reset_rule
        WHEN 'yearly'  THEN to_char(p_at, 'YYYY')
        WHEN 'monthly' THEN to_char(p_at, 'YYYY-MM')
        WHEN 'daily'   THEN to_char(p_at, 'YYYY-MM-DD')
        ELSE ''
    END;
$$;

-- ── 2. Pure renderer ────────────────────────────────────────────────────────
-- Literal substitution over a closed token set — no dynamic SQL, no execution.
-- Mirrors renderDocumentNumber() in service/core/document-format.ts.
CREATE OR REPLACE FUNCTION public.render_document_number(
    p_format  VARCHAR,
    p_prefix  VARCHAR,
    p_padding INT,
    p_seq     BIGINT,
    p_at      TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT replace(replace(replace(replace(replace(replace(
        p_format,
        '{PREFIX}', COALESCE(p_prefix, '')),
        '{YEAR}',   to_char(p_at, 'YYYY')),
        '{YY}',     to_char(p_at, 'YY')),
        '{MONTH}',  to_char(p_at, 'MM')),
        '{DAY}',    to_char(p_at, 'DD')),
        -- CAREFUL: lpad(text, len) TRUNCATES when the value is longer than len
        -- — lpad('1234567', 3, '0') is '123'. Padding must be a MINIMUM width,
        -- never a limit: a sequence that outgrows it simply gets longer,
        -- because dropping high digits would silently collide with an earlier
        -- document. Widening to the value's own length is what prevents that.
        '{NUMBER}', lpad(
            p_seq::text,
            GREATEST(p_padding, 1, length(p_seq::text)),
            '0'
        ));
$$;

-- ── 3. Atomic allocation ────────────────────────────────────────────────────
-- One UPDATE … RETURNING. The row-level lock serializes concurrent callers for
-- the same (company, doc_type); each observes a distinct counter value. There
-- is no read-then-write window anywhere in this function.
--
-- next_value is always set to allocated + 1, which is what makes the RETURNING
-- expression `next_value - 1` exactly the number handed out — true whether or
-- not the period just rolled over. The old function needed a special case for
-- the reset branch; this one does not.
CREATE OR REPLACE FUNCTION public.allocate_document_number(
    p_company_id     INT,
    p_doc_type       VARCHAR,
    p_default_prefix VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    allocated BIGINT,
    prefix    VARCHAR,
    padding   INT,
    format    VARCHAR,
    issued_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_at TIMESTAMPTZ := now();
BEGIN
    -- Lazy seed: a brand-new document type's first call creates its row, so
    -- adding a module never requires a migration.
    INSERT INTO public.document_sequence (company_id, doc_type, prefix)
    VALUES (
        p_company_id,
        p_doc_type,
        -- left(): the fallback derives a prefix from the doc type, and a doc
        -- type is allowed to be far longer than a prefix. Without the clamp a
        -- name like 'inventory_transfer_request' overflows prefix VARCHAR(20)
        -- and raises — and because the VALUES row is built BEFORE the conflict
        -- is detected, it raises even when the sequence already exists and no
        -- insert was going to happen.
        left(COALESCE(p_default_prefix, upper(p_doc_type)), 20)
    )
    ON CONFLICT (company_id, doc_type) DO NOTHING;

    RETURN QUERY
    UPDATE public.document_sequence ds
       SET next_value = (
               CASE
                   WHEN ds.reset_rule <> 'never'
                    AND ds.period_key IS DISTINCT FROM
                        public.document_period_key(ds.reset_rule, v_at)
                   THEN 1                    -- period rolled over: restart
                   ELSE ds.next_value
               END
           ) + 1,
           period_key = CASE
               WHEN ds.reset_rule <> 'never'
               THEN public.document_period_key(ds.reset_rule, v_at)
               ELSE ds.period_key
           END,
           updated_at = v_at
     WHERE ds.company_id = p_company_id
       AND ds.doc_type   = p_doc_type
       AND ds.is_active
    RETURNING ds.next_value - 1, ds.prefix, ds.padding, ds.format, v_at;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No active document sequence for company % and document type %',
            p_company_id, p_doc_type
            USING ERRCODE = 'no_data_found';
    END IF;
END $$;

-- ── 4. Legacy entry point, now a thin wrapper ───────────────────────────────
-- Same signature and same output as before, so the historical migration that
-- calls it keeps replaying correctly. It no longer owns any formatting rule.
CREATE OR REPLACE FUNCTION public.next_document_number(
    p_company_id     INT,
    p_doc_type       VARCHAR,
    p_default_prefix VARCHAR DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
BEGIN
    SELECT * INTO r
      FROM public.allocate_document_number(
               p_company_id, p_doc_type, p_default_prefix);

    RETURN public.render_document_number(
        r.format, r.prefix, r.padding, r.allocated, r.issued_at);
END $$;

-- ── 5. Server-side only ─────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.allocate_document_number(INT, VARCHAR, VARCHAR)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_document_number(INT, VARCHAR, VARCHAR)
    FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.allocate_document_number(INT, VARCHAR, VARCHAR) IS
    'Atomically takes the next counter value and returns it with the sequence '
    'config. Does NOT format — the caller renders, so preview and live '
    'generation share one implementation.';
COMMENT ON FUNCTION public.render_document_number(VARCHAR, VARCHAR, INT, BIGINT, TIMESTAMPTZ) IS
    'Pure token substitution. Mirrors renderDocumentNumber() in '
    'service/core/document-format.ts.';
