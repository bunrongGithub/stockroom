-- ═══════════════════════════════════════════════════════════════════════════
-- Dashboard V1: single-round-trip summary RPC + homepage module row.
--   • get_dashboard_summary aggregates KPIs, sales periods, a 7-day series,
--     inventory stats (warehouse-filterable), document status counts, recent
--     activity and the warehouse list into ONE JSONB payload.
--   • Sales figures come from POSTED invoices only (billing source of truth).
--   • "Low stock" V1 definition: on-hand > 0 AND <= 5 (no per-item reorder
--     level exists yet — future enhancement replaces the constant).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_dashboard_summary(
    p_company_id   INT,
    p_warehouse_id INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_low_threshold NUMERIC := 5;
    v_sales      JSONB;
    v_daily      JSONB;
    v_inventory  JSONB;
    v_documents  JSONB;
    v_recent     JSONB;
    v_warehouses JSONB;
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

    -- ── Last-7-days series ───────────────────────────────────────────────
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

    -- ── Inventory (stock items; optional warehouse filter) ──────────────
    WITH per_item AS (
        SELECT i.id,
               i.track_serial,
               COALESCE(SUM(b.qty_on_hand), 0)                          AS qty,
               COALESCE(SUM(b.qty_on_hand * COALESCE(i.cost, 0)), 0)    AS value
        FROM inventory_item i
        LEFT JOIN inventory_balances b
               ON b.item_id = i.id
              AND b.company_id = p_company_id
              AND (p_warehouse_id IS NULL OR b.warehouse_id = p_warehouse_id)
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

    -- ── Recent activity (5 each) ─────────────────────────────────────────
    SELECT jsonb_build_object(
        'orders', (SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) FROM (
            SELECT jsonb_build_object('id', id, 'no', order_no, 'customer', customer_name,
                                      'date', order_date, 'status', status) AS row_data
            FROM sales_order WHERE company_id = p_company_id
            ORDER BY id DESC LIMIT 5) x),
        'shipments', (SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) FROM (
            SELECT jsonb_build_object('id', id, 'no', shipment_no, 'customer', customer_name,
                                      'date', delivery_date, 'status', status) AS row_data
            FROM sales_shipment WHERE company_id = p_company_id
            ORDER BY id DESC LIMIT 5) x),
        'invoices', (SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) FROM (
            SELECT jsonb_build_object('id', id, 'no', invoice_no, 'customer', customer_name,
                                      'date', invoice_date, 'status', status) AS row_data
            FROM sales_invoice WHERE company_id = p_company_id
            ORDER BY id DESC LIMIT 5) x)
    )
    INTO v_recent;

    -- ── Warehouses (drives the dashboard filter) ─────────────────────────
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY id), '[]'::jsonb)
    INTO v_warehouses
    FROM warehouse
    WHERE company_id = p_company_id;

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
            'out_of_stock_items',           (v_inventory->>'out_of_stock')::int
        ),
        'sales',      jsonb_build_object('periods', v_sales, 'daily', v_daily),
        'inventory',  v_inventory,
        'documents',  v_documents,
        'recent',     v_recent,
        'warehouses', v_warehouses
    );
END;
$$;

-- ── Homepage module row: /dashboard at sort_order 0 (root redirect lands here) ─
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/dashboard', 'Dashboard', '/dashboard', 'DashboardHome',
       NULL, 'transaction', 'LayoutDashboard', 0, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/dashboard');

-- Every role can view the dashboard.
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT r.id, m.id, true, false, false, false, false
FROM roles r
JOIN modules m ON m.path = '/dashboard'
ON CONFLICT (role_id, module_id) DO NOTHING;
