-- ═══════════════════════════════════════════════════════════════════════════
-- Dashboard V1.1: payment/receivables intelligence — same ONE-round-trip
-- contract. Extends get_dashboard_summary with:
--   • payments   : POSTED customer_payment periods + 7-day series
--   • receivables: outstanding invoices count/total + top customers + oldest
--   • invoice_payment_status: UNPAID/PARTIALLY_PAID/PAID counts (derived via
--     the same thresholds as deriveInvoicePayment — never stored)
--   • low_stock_impact: open orders / draft shipments touching low-stock items
--   • recent: adds payments[5]; every recent row now carries created_at+amount
--     (client merges the unified activity timeline — no extra query)
--   • p_location_id: optional inventory filter + locations[] list for the UI
-- Future branch/company filters = more optional params on this same function.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS get_dashboard_summary(INT, INT);

CREATE OR REPLACE FUNCTION get_dashboard_summary(
    p_company_id   INT,
    p_warehouse_id INT DEFAULT NULL,
    p_location_id  INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_low_threshold NUMERIC := 5;
    v_sales      JSONB;
    v_daily      JSONB;
    v_payments   JSONB;
    v_pay_daily  JSONB;
    v_inventory  JSONB;
    v_documents  JSONB;
    v_inv_paystat JSONB;
    v_receivables JSONB;
    v_low_impact JSONB;
    v_recent     JSONB;
    v_warehouses JSONB;
    v_locations  JSONB;
    v_open_orders INT;
    v_ready_to_ship INT;
    v_part_inv_shipments INT;
BEGIN
    -- ── Sales periods (POSTED invoices) ──────────────────────────────────
    SELECT jsonb_build_object(
        'today', jsonb_build_object(
            'total',    COALESCE(SUM(grand_total) FILTER (WHERE invoice_date = CURRENT_DATE), 0),
            'invoices', COUNT(*)                  FILTER (WHERE invoice_date = CURRENT_DATE)),
        'yesterday', jsonb_build_object(
            'total',    COALESCE(SUM(grand_total) FILTER (WHERE invoice_date = CURRENT_DATE - 1), 0),
            'invoices', COUNT(*)                  FILTER (WHERE invoice_date = CURRENT_DATE - 1)),
        'week', jsonb_build_object(
            'total',    COALESCE(SUM(grand_total) FILTER (WHERE invoice_date >= date_trunc('week',  CURRENT_DATE)::date), 0),
            'invoices', COUNT(*)                  FILTER (WHERE invoice_date >= date_trunc('week',  CURRENT_DATE)::date)),
        'month', jsonb_build_object(
            'total',    COALESCE(SUM(grand_total) FILTER (WHERE invoice_date >= date_trunc('month', CURRENT_DATE)::date), 0),
            'invoices', COUNT(*)                  FILTER (WHERE invoice_date >= date_trunc('month', CURRENT_DATE)::date))
    )
    INTO v_sales
    FROM sales_invoice
    WHERE company_id = p_company_id AND status = 'POSTED';

    SELECT COALESCE(
        jsonb_agg(jsonb_build_object('day', d.day, 'total', COALESCE(s.total, 0)) ORDER BY d.day),
        '[]'::jsonb)
    INTO v_daily
    FROM (SELECT generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day')::date AS day) d
    LEFT JOIN (
        SELECT invoice_date AS day, SUM(grand_total) AS total
        FROM sales_invoice
        WHERE company_id = p_company_id AND status = 'POSTED'
          AND invoice_date >= CURRENT_DATE - 6
        GROUP BY invoice_date
    ) s ON s.day = d.day;

    -- ── Payment periods (POSTED customer payments) ───────────────────────
    SELECT jsonb_build_object(
        'today', jsonb_build_object(
            'total', COALESCE(SUM(amount) FILTER (WHERE payment_date = CURRENT_DATE), 0),
            'count', COUNT(*)             FILTER (WHERE payment_date = CURRENT_DATE)),
        'yesterday', jsonb_build_object(
            'total', COALESCE(SUM(amount) FILTER (WHERE payment_date = CURRENT_DATE - 1), 0),
            'count', COUNT(*)             FILTER (WHERE payment_date = CURRENT_DATE - 1)),
        'week', jsonb_build_object(
            'total', COALESCE(SUM(amount) FILTER (WHERE payment_date >= date_trunc('week',  CURRENT_DATE)::date), 0),
            'count', COUNT(*)             FILTER (WHERE payment_date >= date_trunc('week',  CURRENT_DATE)::date)),
        'month', jsonb_build_object(
            'total', COALESCE(SUM(amount) FILTER (WHERE payment_date >= date_trunc('month', CURRENT_DATE)::date), 0),
            'count', COUNT(*)             FILTER (WHERE payment_date >= date_trunc('month', CURRENT_DATE)::date))
    )
    INTO v_payments
    FROM customer_payment
    WHERE company_id = p_company_id AND status = 'POSTED';

    SELECT COALESCE(
        jsonb_agg(jsonb_build_object('day', d.day, 'total', COALESCE(s.total, 0)) ORDER BY d.day),
        '[]'::jsonb)
    INTO v_pay_daily
    FROM (SELECT generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day')::date AS day) d
    LEFT JOIN (
        SELECT payment_date AS day, SUM(amount) AS total
        FROM customer_payment
        WHERE company_id = p_company_id AND status = 'POSTED'
          AND payment_date >= CURRENT_DATE - 6
        GROUP BY payment_date
    ) s ON s.day = d.day;

    -- ── Inventory (stock items; warehouse + location filters) ────────────
    WITH per_item AS (
        SELECT i.id,
               i.track_serial,
               COALESCE(SUM(b.qty_on_hand), 0)                       AS qty,
               COALESCE(SUM(b.qty_on_hand * COALESCE(i.cost, 0)), 0) AS value
        FROM inventory_item i
        LEFT JOIN inventory_balances b
               ON b.item_id = i.id
              AND b.company_id = p_company_id
              AND (p_warehouse_id IS NULL OR b.warehouse_id = p_warehouse_id)
              AND (p_location_id  IS NULL OR b.location_id  = p_location_id)
        WHERE i.company_id = p_company_id
          AND i.item_class = 'stock'
        GROUP BY i.id, i.track_serial
    )
    SELECT jsonb_build_object(
        'total_stock_items', COUNT(*),
        'total_qty',         COALESCE(SUM(qty), 0),
        'total_value',       COALESCE(SUM(value), 0),
        'low_stock',         COUNT(*) FILTER (WHERE qty > 0 AND qty <= v_low_threshold),
        'out_of_stock',      COUNT(*) FILTER (WHERE qty <= 0),
        'serial_items',      COUNT(*) FILTER (WHERE track_serial)
    )
    INTO v_inventory
    FROM per_item;

    -- ── Low-stock sales impact (open docs touching low/out-of-stock items) ─
    WITH per_item AS (
        SELECT i.id, COALESCE(SUM(b.qty_on_hand), 0) AS qty
        FROM inventory_item i
        LEFT JOIN inventory_balances b
               ON b.item_id = i.id
              AND b.company_id = p_company_id
              AND (p_warehouse_id IS NULL OR b.warehouse_id = p_warehouse_id)
              AND (p_location_id  IS NULL OR b.location_id  = p_location_id)
        WHERE i.company_id = p_company_id AND i.item_class = 'stock'
        GROUP BY i.id
    ), low_items AS (
        SELECT id FROM per_item WHERE qty <= v_low_threshold
    )
    SELECT jsonb_build_object(
        'affected_orders', (
            SELECT COUNT(DISTINCT o.id) FROM sales_order o
            JOIN sales_order_items oi ON oi.order_id = o.id
            WHERE o.company_id = p_company_id
              AND o.status IN ('open', 'partial_shipment')
              AND oi.item_id IN (SELECT id FROM low_items)),
        'affected_shipments', (
            SELECT COUNT(DISTINCT sh.id) FROM sales_shipment sh
            JOIN sales_shipment_items si ON si.shipment_id = sh.id
            WHERE sh.company_id = p_company_id
              AND sh.status = 'DRAFT'
              AND si.item_id IN (SELECT id FROM low_items))
    )
    INTO v_low_impact;

    -- ── Document status counts ───────────────────────────────────────────
    SELECT jsonb_build_object(
        'orders',    (SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
                      FROM (SELECT status, COUNT(*) AS cnt FROM sales_order
                            WHERE company_id = p_company_id GROUP BY status) t),
        'shipments', (SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
                      FROM (SELECT status, COUNT(*) AS cnt FROM sales_shipment
                            WHERE company_id = p_company_id GROUP BY status) t),
        'invoices',  (SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
                      FROM (SELECT status, COUNT(*) AS cnt FROM sales_invoice
                            WHERE company_id = p_company_id GROUP BY status) t)
    )
    INTO v_documents;

    -- ── Invoice payment-status counts (derived, POSTED invoices only) ────
    SELECT jsonb_build_object(
        'UNPAID',         COUNT(*) FILTER (WHERE amount_paid <= 0),
        'PARTIALLY_PAID', COUNT(*) FILTER (WHERE amount_paid > 0 AND amount_paid < grand_total),
        'PAID',           COUNT(*) FILTER (WHERE amount_paid >= grand_total)
    )
    INTO v_inv_paystat
    FROM sales_invoice
    WHERE company_id = p_company_id AND status = 'POSTED';

    -- ── Receivables (outstanding invoices) ───────────────────────────────
    SELECT jsonb_build_object(
        'invoice_count',    COUNT(*),
        'total_outstanding', COALESCE(SUM(outstanding), 0),
        'top_customers', (
            SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) FROM (
                SELECT jsonb_build_object(
                    'customer', COALESCE(customer_name, '—'),
                    'outstanding', SUM(outstanding),
                    'invoices', COUNT(*)) AS row_data
                FROM sales_invoice
                WHERE company_id = p_company_id AND status = 'POSTED' AND outstanding > 0
                GROUP BY customer_name
                ORDER BY SUM(outstanding) DESC
                LIMIT 5) x),
        'oldest', (
            SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) FROM (
                SELECT jsonb_build_object(
                    'id', id, 'no', invoice_no, 'customer', customer_name,
                    'date', invoice_date, 'outstanding', outstanding) AS row_data
                FROM sales_invoice
                WHERE company_id = p_company_id AND status = 'POSTED' AND outstanding > 0
                ORDER BY invoice_date ASC, id ASC
                LIMIT 5) x)
    )
    INTO v_receivables
    FROM sales_invoice
    WHERE company_id = p_company_id AND status = 'POSTED' AND outstanding > 0;

    -- ── Recent activity (5 each; created_at + amount power the timeline) ──
    SELECT jsonb_build_object(
        'orders', (SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) FROM (
            SELECT jsonb_build_object('id', id, 'no', order_no, 'customer', customer_name,
                                      'date', order_date, 'status', status,
                                      'created_at', created_at, 'amount', grand_total) AS row_data
            FROM sales_order WHERE company_id = p_company_id
            ORDER BY id DESC LIMIT 5) x),
        'shipments', (SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) FROM (
            SELECT jsonb_build_object('id', id, 'no', shipment_no, 'customer', customer_name,
                                      'date', delivery_date, 'status', status,
                                      'created_at', created_at, 'amount', NULL) AS row_data
            FROM sales_shipment WHERE company_id = p_company_id
            ORDER BY id DESC LIMIT 5) x),
        'invoices', (SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) FROM (
            SELECT jsonb_build_object('id', id, 'no', invoice_no, 'customer', customer_name,
                                      'date', invoice_date, 'status', status,
                                      'created_at', created_at, 'amount', grand_total) AS row_data
            FROM sales_invoice WHERE company_id = p_company_id
            ORDER BY id DESC LIMIT 5) x),
        'payments', (SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) FROM (
            SELECT jsonb_build_object('id', id, 'no', payment_no, 'customer', customer_name,
                                      'date', payment_date, 'status', status,
                                      'created_at', created_at, 'amount', amount,
                                      'method', payment_method) AS row_data
            FROM customer_payment WHERE company_id = p_company_id
            ORDER BY id DESC LIMIT 5) x)
    )
    INTO v_recent;

    -- ── Warehouses + locations (filter UIs) ──────────────────────────────
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY id), '[]'::jsonb)
    INTO v_warehouses
    FROM warehouse
    WHERE company_id = p_company_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', wl.id, 'name', wl.name, 'warehouse_id', wl.warehouse_id) ORDER BY wl.id), '[]'::jsonb)
    INTO v_locations
    FROM warehouse_location wl
    JOIN warehouse w ON w.id = wl.warehouse_id
    WHERE w.company_id = p_company_id
      AND (p_warehouse_id IS NULL OR wl.warehouse_id = p_warehouse_id);

    -- ── KPI counts ───────────────────────────────────────────────────────
    SELECT COUNT(*) INTO v_open_orders
    FROM sales_order WHERE company_id = p_company_id AND status = 'open';

    SELECT COUNT(*) INTO v_ready_to_ship
    FROM sales_order WHERE company_id = p_company_id AND status IN ('open', 'partial_shipment');

    SELECT COUNT(*) INTO v_part_inv_shipments
    FROM sales_shipment WHERE company_id = p_company_id AND status = 'PARTIALLY_INVOICED';

    RETURN jsonb_build_object(
        'kpis', jsonb_build_object(
            'sales_today',                  (v_sales->'today'->>'total')::numeric,
            'sales_month',                  (v_sales->'month'->>'total')::numeric,
            'open_orders',                  v_open_orders,
            'ready_to_ship',                v_ready_to_ship,
            'partially_invoiced_shipments', v_part_inv_shipments,
            'posted_invoices_month',        (v_sales->'month'->>'invoices')::int,
            'low_stock_items',              (v_inventory->>'low_stock')::int,
            'out_of_stock_items',           (v_inventory->>'out_of_stock')::int,
            'payments_today',               (v_payments->'today'->>'total')::numeric,
            'payments_today_count',         (v_payments->'today'->>'count')::int,
            'payments_month',               (v_payments->'month'->>'total')::numeric,
            'payments_month_count',         (v_payments->'month'->>'count')::int,
            'outstanding_invoices',         COALESCE((v_receivables->>'invoice_count')::int, 0),
            'outstanding_amount',           COALESCE((v_receivables->>'total_outstanding')::numeric, 0)
        ),
        'sales',      jsonb_build_object('periods', v_sales, 'daily', v_daily),
        'payments',   jsonb_build_object('periods', v_payments, 'daily', v_pay_daily),
        'inventory',  v_inventory,
        'low_stock_impact', v_low_impact,
        'documents',  v_documents,
        'invoice_payment_status', v_inv_paystat,
        'receivables', COALESCE(v_receivables,
            jsonb_build_object('invoice_count', 0, 'total_outstanding', 0,
                               'top_customers', '[]'::jsonb, 'oldest', '[]'::jsonb)),
        'recent',     v_recent,
        'warehouses', v_warehouses,
        'locations',  v_locations
    );
END;
$$;
