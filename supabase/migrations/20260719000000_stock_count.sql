-- ═══════════════════════════════════════════════════════════════════════════
-- Physical Stock Count: counting workflow that DISCOVERS inventory variance
-- and, on approval, CORRECTS it through the existing Stock Adjustment service
-- (reason STOCK_COUNT) — never touching inventory_balances directly.
--   • Frozen snapshot at prepare: qty per balance bucket + expected serials.
--   • Displayed variance = counted − snapshot; generated adjustment targets
--     counted − LIVE on-hand (drift is surfaced, snapshot stays immutable).
--   • One adjustment per location (stock_adjustment.location_id is NOT NULL);
--     stock_count_adjustment UNIQUE (count_id, location_id) makes a failed
--     multi-location approval safely re-runnable.
--   • Future-ready: count_mode leaves room for cycle/blind; line-level
--     counted_by/status enable multi-counter task assignment later.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Count session header ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_count (
    id                  BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id          INT          NOT NULL REFERENCES company(id),
    user_id             UUID         REFERENCES profiles(id),
    count_no            VARCHAR(30)  NOT NULL,
    count_date          DATE         NOT NULL DEFAULT CURRENT_DATE,
    warehouse_id        INT          NOT NULL REFERENCES warehouse(id),
    location_id         INT          REFERENCES warehouse_location(id), -- NULL = all locations
    count_mode          VARCHAR(20)  NOT NULL DEFAULT 'full',
    scope_filter        JSONB        NOT NULL DEFAULT '{}'::jsonb,      -- { category_ids: [], item_ids: [] }
    uncounted_policy    VARCHAR(20)  NOT NULL DEFAULT 'ignore',
    status              VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    snapshot_at         TIMESTAMPTZ,
    counting_started_at TIMESTAMPTZ,
    submitted_by        UUID         REFERENCES profiles(id),
    submitted_at        TIMESTAMPTZ,
    approved_by         UUID         REFERENCES profiles(id),
    approved_at         TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    cancelled_by        UUID         REFERENCES profiles(id),
    cancelled_at        TIMESTAMPTZ,
    cancel_reason       TEXT,
    remarks             TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         REFERENCES profiles(id) ON DELETE SET NULL,
    updated_by          UUID         REFERENCES profiles(id) ON DELETE SET NULL,

    CONSTRAINT uq_stock_count_no_per_company UNIQUE (company_id, count_no),
    CONSTRAINT chk_stock_count_status CHECK (status IN
        ('DRAFT','PREPARED','COUNTING','PENDING_APPROVAL','APPROVED','COMPLETED','CANCELLED')),
    CONSTRAINT chk_stock_count_mode CHECK (count_mode IN ('full','location','category','items')),
    CONSTRAINT chk_stock_count_uncounted_policy CHECK (uncounted_policy IN ('ignore','zero'))
);

CREATE INDEX IF NOT EXISTS idx_stock_count_company   ON stock_count (company_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_status    ON stock_count (company_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_count_warehouse ON stock_count (warehouse_id);

DROP TRIGGER IF EXISTS trg_stock_count_updated_at ON stock_count;
CREATE TRIGGER trg_stock_count_updated_at
    BEFORE UPDATE ON stock_count
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_stock_count_audit_guard ON stock_count;
CREATE TRIGGER trg_stock_count_audit_guard
    BEFORE UPDATE ON stock_count
    FOR EACH ROW EXECUTE FUNCTION fn_audit_guard();

ALTER TABLE public.stock_count ENABLE ROW LEVEL SECURITY;

-- ── 2. Count lines (100k-scale worksheet) ───────────────────────────────────
-- sku/item_name are denormalized at prepare so the query framework can search
-- the worksheet without joining inventory_item; the whole row is a snapshot.
CREATE TABLE IF NOT EXISTS stock_count_items (
    id           BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    count_id     BIGINT        NOT NULL REFERENCES stock_count(id) ON DELETE CASCADE,
    company_id   INT           NOT NULL REFERENCES company(id),
    item_id      INT           NOT NULL REFERENCES inventory_item(id),
    location_id  INT           NOT NULL REFERENCES warehouse_location(id),
    item_uom_id  INT           REFERENCES inventory_item_uom(id),
    sku          VARCHAR(100),
    item_name    VARCHAR(255),
    is_serial    BOOLEAN       NOT NULL DEFAULT FALSE,
    snapshot_qty NUMERIC(18,6) NOT NULL DEFAULT 0,
    unit_cost    NUMERIC(18,6),
    counted_qty  NUMERIC(18,6),                        -- NULL = not yet counted
    variance_qty NUMERIC(18,6) GENERATED ALWAYS AS (counted_qty - snapshot_qty) STORED,
    status       VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    counted_by   UUID          REFERENCES profiles(id),
    counted_at   TIMESTAMPTZ,
    remarks      TEXT,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_stock_count_items_bucket UNIQUE (count_id, item_id, location_id),
    CONSTRAINT chk_stock_count_items_qty CHECK (counted_qty IS NULL OR counted_qty >= 0),
    CONSTRAINT chk_stock_count_items_status CHECK (status IN ('PENDING','COUNTED'))
);

CREATE INDEX IF NOT EXISTS idx_stock_count_items_parent   ON stock_count_items (count_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_status   ON stock_count_items (count_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_sku      ON stock_count_items (count_id, sku);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_variance ON stock_count_items (count_id)
    WHERE variance_qty IS NOT NULL AND variance_qty <> 0;

DROP TRIGGER IF EXISTS trg_stock_count_items_updated_at ON stock_count_items;
CREATE TRIGGER trg_stock_count_items_updated_at
    BEFORE UPDATE ON stock_count_items
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;

-- ── 3. Serial reconciliation rows ───────────────────────────────────────────
-- Expected snapshot (is_expected) ∪ scanned actuals (is_scanned):
--   matched  = expected + scanned          → no action
--   missing  = expected, never scanned     → adjustment OUT at approval
--   new      = scanned, not in system      → adjustment IN at approval
--   foreign  = scanned, exists elsewhere   → investigation only, never adjusted
CREATE TABLE IF NOT EXISTS stock_count_serials (
    id            BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    count_id      BIGINT       NOT NULL REFERENCES stock_count(id) ON DELETE CASCADE,
    count_item_id BIGINT       NOT NULL REFERENCES stock_count_items(id) ON DELETE CASCADE,
    company_id    INT          NOT NULL REFERENCES company(id),
    serial_number VARCHAR(100) NOT NULL,
    serial_id     BIGINT       REFERENCES inventory_serial(id),
    is_expected   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_scanned    BOOLEAN      NOT NULL DEFAULT FALSE,
    classification VARCHAR(20),
    scanned_by    UUID         REFERENCES profiles(id),
    scanned_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_stock_count_serials_per_line UNIQUE (count_item_id, serial_number),
    CONSTRAINT chk_stock_count_serials_class CHECK (classification IS NULL OR
        classification IN ('matched','missing','new','foreign'))
);

CREATE INDEX IF NOT EXISTS idx_stock_count_serials_count ON stock_count_serials (count_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_serials_line  ON stock_count_serials (count_item_id);

ALTER TABLE public.stock_count_serials ENABLE ROW LEVEL SECURITY;

-- ── 4. Generated-adjustment link (approval idempotency) ─────────────────────
CREATE TABLE IF NOT EXISTS stock_count_adjustment (
    id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    count_id      BIGINT      NOT NULL REFERENCES stock_count(id) ON DELETE CASCADE,
    adjustment_id BIGINT      NOT NULL REFERENCES stock_adjustment(id),
    location_id   INT         NOT NULL REFERENCES warehouse_location(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_stock_count_adjustment UNIQUE (count_id, adjustment_id),
    CONSTRAINT uq_stock_count_adjustment_location UNIQUE (count_id, location_id)
);

ALTER TABLE public.stock_count_adjustment ENABLE ROW LEVEL SECURITY;

-- ── 5. Atomic snapshot freeze (set-based, 100k-safe) ────────────────────────
CREATE OR REPLACE FUNCTION public.fn_prepare_stock_count(p_count_id BIGINT)
RETURNS TABLE (line_count INT, serial_count INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_header stock_count%ROWTYPE;
    v_lines  INT;
    v_serials INT;
BEGIN
    SELECT * INTO v_header FROM stock_count WHERE id = p_count_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'STOCK_COUNT_NOT_FOUND';
    END IF;
    IF v_header.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'INVALID_STATUS: expected DRAFT, got %', v_header.status;
    END IF;

    -- 5a. Freeze one line per balance bucket in scope (zero-qty buckets stay
    -- in: physical stock may be found where the system says none).
    INSERT INTO stock_count_items
        (count_id, company_id, item_id, location_id, item_uom_id,
         sku, item_name, is_serial, snapshot_qty, unit_cost)
    SELECT p_count_id, b.company_id, b.item_id, b.location_id, du.id,
           i.sku, i.name, i.track_serial, b.qty_on_hand, i.cost
    FROM inventory_balances b
    JOIN inventory_item i ON i.id = b.item_id
    LEFT JOIN LATERAL (
        SELECT iu.id FROM inventory_item_uom iu
        WHERE iu.item_id = i.id AND iu.is_default
        ORDER BY iu.id LIMIT 1
    ) du ON TRUE
    WHERE b.company_id  = v_header.company_id
      AND b.warehouse_id = v_header.warehouse_id
      AND (v_header.location_id IS NULL OR b.location_id = v_header.location_id)
      AND i.item_class = 'stock'
      AND (
          NOT (v_header.scope_filter ? 'category_ids')
          OR jsonb_array_length(v_header.scope_filter->'category_ids') = 0
          OR i.category_id IN (
              SELECT (jsonb_array_elements_text(v_header.scope_filter->'category_ids'))::bigint)
      )
      AND (
          NOT (v_header.scope_filter ? 'item_ids')
          OR jsonb_array_length(v_header.scope_filter->'item_ids') = 0
          OR i.id IN (
              SELECT (jsonb_array_elements_text(v_header.scope_filter->'item_ids'))::bigint)
      );
    GET DIAGNOSTICS v_lines = ROW_COUNT;

    -- 5b. Freeze expected serials for serial-tracked lines.
    INSERT INTO stock_count_serials
        (count_id, count_item_id, company_id, serial_number, serial_id, is_expected)
    SELECT p_count_id, ci.id, s.company_id, s.serial_number, s.id, TRUE
    FROM stock_count_items ci
    JOIN inventory_serial s
      ON s.company_id  = ci.company_id
     AND s.item_id     = ci.item_id
     AND s.location_id = ci.location_id
     AND s.warehouse_id = (SELECT warehouse_id FROM stock_count WHERE id = p_count_id)
     AND s.status = 'available'
    WHERE ci.count_id = p_count_id
      AND ci.is_serial;
    GET DIAGNOSTICS v_serials = ROW_COUNT;

    UPDATE stock_count
       SET status = 'PREPARED', snapshot_at = NOW()
     WHERE id = p_count_id;

    RETURN QUERY SELECT v_lines, v_serials;
END;
$$;

-- ── 6. One-scan dashboard aggregate ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_stock_count_summary(p_count_id BIGINT)
RETURNS TABLE (
    total_lines    BIGINT,
    counted_lines  BIGINT,
    pending_lines  BIGINT,
    positive_lines BIGINT,
    negative_lines BIGINT,
    zero_lines     BIGINT,
    qty_over       NUMERIC,
    qty_short      NUMERIC,
    variance_value NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'COUNTED'),
        COUNT(*) FILTER (WHERE status = 'PENDING'),
        COUNT(*) FILTER (WHERE variance_qty > 0),
        COUNT(*) FILTER (WHERE variance_qty < 0),
        COUNT(*) FILTER (WHERE variance_qty = 0),
        COALESCE(SUM(variance_qty) FILTER (WHERE variance_qty > 0), 0),
        COALESCE(SUM(-variance_qty) FILTER (WHERE variance_qty < 0), 0),
        COALESCE(SUM(variance_qty * COALESCE(unit_cost, 0)), 0)
    FROM stock_count_items
    WHERE count_id = p_count_id;
$$;

-- ── 7. Module rows ──────────────────────────────────────────────────────────
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/stock_count', 'Stock Count', '/inventory/stock_count',
       'InventoryStockCountModule',
       (SELECT id FROM modules WHERE path = '/inventory'),
       'transaction', 'ClipboardList', 3, true
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/stock_count');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/inventory/stock_count/create', 'Create', '/inventory/stock_count/create',
       'InventoryStockCountCreate',
       (SELECT id FROM modules WHERE path = '/inventory/stock_count'), 'action', 1, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/stock_count/create');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/inventory/stock_count/:id/view', 'View', '/inventory/stock_count/:id/view',
       'InventoryStockCountDetail',
       (SELECT id FROM modules WHERE path = '/inventory/stock_count'), 'action', 2, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/stock_count/:id/view');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/inventory/stock_count/:id/update', 'Update', '/inventory/stock_count/:id/update',
       'InventoryStockCountUpdate',
       (SELECT id FROM modules WHERE path = '/inventory/stock_count'), 'action', 3, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/stock_count/:id/update');

-- Dedicated permission-carrier action rows for the workflow verbs. The 5-flag
-- permission model has no "approve" flag; the convention is one module row per
-- privileged action, gated by can_update on that row. Direct navigation to
-- these paths just shows the detail workspace.
INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/inventory/stock_count/:id/prepare', 'Prepare', '/inventory/stock_count/:id/prepare',
       'InventoryStockCountDetail',
       (SELECT id FROM modules WHERE path = '/inventory/stock_count'), 'action', 4, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/stock_count/:id/prepare');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/inventory/stock_count/:id/count', 'Count', '/inventory/stock_count/:id/count',
       'InventoryStockCountDetail',
       (SELECT id FROM modules WHERE path = '/inventory/stock_count'), 'action', 5, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/stock_count/:id/count');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/inventory/stock_count/:id/approve', 'Approve', '/inventory/stock_count/:id/approve',
       'InventoryStockCountDetail',
       (SELECT id FROM modules WHERE path = '/inventory/stock_count'), 'action', 6, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/stock_count/:id/approve');

-- Permissions: mirror the stock_adjust sibling onto all seven rows.
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/inventory/stock_adjust'
JOIN modules dst ON dst.path IN (
    '/inventory/stock_count',
    '/inventory/stock_count/create',
    '/inventory/stock_count/:id/view',
    '/inventory/stock_count/:id/update',
    '/inventory/stock_count/:id/prepare',
    '/inventory/stock_count/:id/count',
    '/inventory/stock_count/:id/approve')
ON CONFLICT (role_id, module_id) DO NOTHING;
