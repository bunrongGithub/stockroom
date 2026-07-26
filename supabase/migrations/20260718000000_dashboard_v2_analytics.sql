-- ═══════════════════════════════════════════════════════════════════════════
-- Dashboard V2: reusable analytics time-series RPC + supporting indexes.
--   • fn_timeseries_buckets generates a gap-filled bucket axis (hour/day/month)
--     shared by every metric — charts never show holes for empty periods.
--   • get_dashboard_timeseries returns ONE row per bucket, aggregated in SQL
--     (SUM / COUNT / date_trunc), so the payload stays ≤ ~366 points no matter
--     how many transactions exist. Metrics:
--       'sales'    → posted-invoice amount/count + order-intake amount/count
--       'payments' → posted customer-payment amount/count
--     Future metrics (inventory value, customer growth, …) are added as a new
--     ELSIF branch reusing the same bucket axis and wire shape.
--   • 'hour' buckets distribute a day's documents by created_at (document
--     dates are DATE columns); day/month buckets group the document date.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_timeseries_buckets(
    p_from   DATE,
    p_to     DATE,
    p_bucket TEXT
)
RETURNS TABLE(bucket TIMESTAMP)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT generate_series(
        date_trunc(p_bucket, p_from::timestamp),
        CASE WHEN p_bucket = 'hour'
             THEN p_to::timestamp + interval '23 hours'
             ELSE date_trunc(p_bucket, p_to::timestamp) END,
        ('1 ' || p_bucket)::interval
    );
$$;

CREATE OR REPLACE FUNCTION get_dashboard_timeseries(
    p_company_id INT,
    p_metric     TEXT,
    p_from       DATE,
    p_to         DATE,
    p_bucket     TEXT DEFAULT 'day'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_series JSONB;
BEGIN
    IF p_bucket NOT IN ('hour', 'day', 'month') THEN
        RAISE EXCEPTION 'Invalid bucket: %', p_bucket;
    END IF;
    IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
        RAISE EXCEPTION 'Invalid date range';
    END IF;

    IF p_metric = 'sales' THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'bucket',        b.bucket,
                'invoiced',      COALESCE(i.total, 0),
                'invoice_count', COALESCE(i.cnt, 0),
                'orders',        COALESCE(o.total, 0),
                'order_count',   COALESCE(o.cnt, 0)
            ) ORDER BY b.bucket), '[]'::jsonb)
        INTO v_series
        FROM fn_timeseries_buckets(p_from, p_to, p_bucket) b
        LEFT JOIN (
            SELECT CASE WHEN p_bucket = 'hour'
                        THEN date_trunc('hour', created_at::timestamp)
                        ELSE date_trunc(p_bucket, invoice_date::timestamp) END AS bucket,
                   SUM(grand_total) AS total,
                   COUNT(*)         AS cnt
            FROM sales_invoice
            WHERE company_id = p_company_id
              AND status = 'POSTED'
              AND invoice_date BETWEEN p_from AND p_to
            GROUP BY 1
        ) i ON i.bucket = b.bucket
        LEFT JOIN (
            SELECT CASE WHEN p_bucket = 'hour'
                        THEN date_trunc('hour', created_at::timestamp)
                        ELSE date_trunc(p_bucket, order_date::timestamp) END AS bucket,
                   SUM(grand_total) AS total,
                   COUNT(*)         AS cnt
            FROM sales_order
            WHERE company_id = p_company_id
              AND status <> 'cancelled'
              AND order_date BETWEEN p_from AND p_to
            GROUP BY 1
        ) o ON o.bucket = b.bucket;

    ELSIF p_metric = 'payments' THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'bucket',   b.bucket,
                'received', COALESCE(p.total, 0),
                'count',    COALESCE(p.cnt, 0)
            ) ORDER BY b.bucket), '[]'::jsonb)
        INTO v_series
        FROM fn_timeseries_buckets(p_from, p_to, p_bucket) b
        LEFT JOIN (
            SELECT CASE WHEN p_bucket = 'hour'
                        THEN date_trunc('hour', created_at::timestamp)
                        ELSE date_trunc(p_bucket, payment_date::timestamp) END AS bucket,
                   SUM(amount) AS total,
                   COUNT(*)    AS cnt
            FROM customer_payment
            WHERE company_id = p_company_id
              AND status = 'POSTED'
              AND payment_date BETWEEN p_from AND p_to
            GROUP BY 1
        ) p ON p.bucket = b.bucket;

    ELSE
        RAISE EXCEPTION 'Unknown metric: %', p_metric;
    END IF;

    RETURN v_series;
END;
$$;

-- ── Aggregation indexes (company + status + document date) ──────────────────
CREATE INDEX IF NOT EXISTS idx_sales_invoice_company_status_date
    ON sales_invoice (company_id, status, invoice_date);
CREATE INDEX IF NOT EXISTS idx_customer_payment_company_status_date
    ON customer_payment (company_id, status, payment_date);
CREATE INDEX IF NOT EXISTS idx_sales_order_company_date
    ON sales_order (company_id, order_date);
