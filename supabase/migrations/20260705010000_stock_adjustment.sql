-- ═══════════════════════════════════════════════════════════════════════════
-- Stock Adjustment: corrects inventory discrepancies THROUGH the movement
-- engine (createMovement is the only balance writer — adjustments never touch
-- inventory_balances directly). DRAFT → POSTED (movements + serials + lock).
--   • adjustment_reason: reusable reason configuration (future CRUD page).
--   • Signed adjustment_qty per line (+in / −out); serials mandatory-matched.
--   • inventory_serial gains 'removed' (generic negative-adjustment terminal
--     state; DAMAGED→'damaged', EXPIRED→'scrapped' reuse existing statuses).
--   • Future cancellation = opposite movements; no schema change needed.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Reusable adjustment reasons ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adjustment_reason (
    id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code       VARCHAR(30) NOT NULL UNIQUE,
    label      VARCHAR(100) NOT NULL,
    sort_order INT         NOT NULL DEFAULT 0,
    is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO adjustment_reason (code, label, sort_order) VALUES
    ('WRONG_RECEIPT', 'Wrong Receipt',          1),
    ('DAMAGED',       'Damaged',                2),
    ('LOST',          'Lost',                   3),
    ('FOUND',         'Found',                  4),
    ('EXPIRED',       'Expired',                5),
    ('STOCK_COUNT',   'Stock Count Difference', 6),
    ('MANUAL',        'Manual Correction',      7),
    ('OTHER',         'Other',                  8)
ON CONFLICT (code) DO NOTHING;

-- ── 2. Adjustment header ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_adjustment (
    id              BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id      INT          NOT NULL REFERENCES company(id),
    user_id         UUID         REFERENCES profiles(id),
    adjustment_no   VARCHAR(30)  NOT NULL,
    reference_no    VARCHAR(100),                    -- user-entered
    adjustment_date DATE         NOT NULL DEFAULT CURRENT_DATE,
    warehouse_id    INT          NOT NULL REFERENCES warehouse(id),
    location_id     INT          NOT NULL REFERENCES warehouse_location(id),
    reason_code     VARCHAR(30)  NOT NULL REFERENCES adjustment_reason(code),
    remarks         TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    posted_by       UUID         REFERENCES profiles(id),
    posted_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_stock_adjustment_no_per_company UNIQUE (company_id, adjustment_no),
    CONSTRAINT chk_stock_adjustment_status CHECK (status IN ('DRAFT', 'POSTED', 'VOID'))
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustment_company ON stock_adjustment (company_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_status  ON stock_adjustment (company_id, status);

DROP TRIGGER IF EXISTS trg_stock_adjustment_updated_at ON stock_adjustment;
CREATE TRIGGER trg_stock_adjustment_updated_at
    BEFORE UPDATE ON stock_adjustment
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 3. Adjustment lines (signed qty; serials as input carrier) ──────────────
CREATE TABLE IF NOT EXISTS stock_adjustment_items (
    id             BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    adjustment_id  BIGINT        NOT NULL REFERENCES stock_adjustment(id) ON DELETE CASCADE,
    company_id     INT           NOT NULL REFERENCES company(id),
    item_id        INT           NOT NULL REFERENCES inventory_item(id),
    item_uom_id    INT           REFERENCES inventory_item_uom(id),
    description    TEXT,
    current_qty    NUMERIC(18,6) NOT NULL DEFAULT 0,   -- snapshot when line added
    adjustment_qty NUMERIC(18,6) NOT NULL,             -- signed: + in / − out
    new_qty        NUMERIC(18,6) NOT NULL DEFAULT 0,   -- snapshot calc
    unit_cost      NUMERIC(18,6),                      -- IN lines
    serial_numbers JSONB         NOT NULL DEFAULT '[]'::jsonb,
    remarks        TEXT,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_stock_adjustment_item_qty CHECK (adjustment_qty <> 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustment_items_parent
    ON stock_adjustment_items (adjustment_id);

DROP TRIGGER IF EXISTS trg_stock_adjustment_items_updated_at ON stock_adjustment_items;
CREATE TRIGGER trg_stock_adjustment_items_updated_at
    BEFORE UPDATE ON stock_adjustment_items
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 4. Serial terminal state for negative adjustments ───────────────────────
ALTER TABLE inventory_serial DROP CONSTRAINT IF EXISTS chk_inventory_serial_status;
ALTER TABLE inventory_serial ADD CONSTRAINT chk_inventory_serial_status
    CHECK (status IN ('available', 'reserved', 'sold', 'returned',
                      'damaged', 'scrapped', 'removed'));

-- ── 5. Module rows ───────────────────────────────────────────────────────────
-- The stock_adjust parent may not exist in a given environment (the original
-- seed predates some DBs) — create it under /inventory when missing.
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/stock_adjust', 'Stock Adjustment', '/inventory/stock_adjust',
       'InventoryStockAdjModule',
       (SELECT id FROM modules WHERE path = '/inventory'),
       'transaction', 'ArrowLeftRight', 2, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/stock_adjust');

UPDATE modules SET label = 'Stock Adjustment' WHERE path = '/inventory/stock_adjust';

-- Re-parent action rows if they were created before the parent existed.
UPDATE modules SET parent_id = (SELECT id FROM modules WHERE path = '/inventory/stock_adjust')
WHERE path LIKE '/inventory/stock_adjust/%' AND parent_id IS NULL;

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/inventory/stock_adjust/create', 'Create', '/inventory/stock_adjust/create',
       'InventoryStockAdjCreate',
       (SELECT id FROM modules WHERE path = '/inventory/stock_adjust'), 'action', 1, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/stock_adjust/create');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/inventory/stock_adjust/:id/view', 'View', '/inventory/stock_adjust/:id/view',
       'InventoryStockAdjDetail',
       (SELECT id FROM modules WHERE path = '/inventory/stock_adjust'), 'action', 2, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/stock_adjust/:id/view');

INSERT INTO modules (key, label, path, component, parent_id, type, sort_order, is_initial_data)
SELECT '/inventory/stock_adjust/:id/update', 'Update', '/inventory/stock_adjust/:id/update',
       'InventoryStockAdjUpdate',
       (SELECT id FROM modules WHERE path = '/inventory/stock_adjust'), 'action', 3, false
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE path = '/inventory/stock_adjust/:id/update');

-- Permissions: mirror the receipts module (the sibling transaction) onto the
-- stock_adjust parent + all three action rows.
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/inventory/receipts'
JOIN modules dst ON dst.path IN (
    '/inventory/stock_adjust',
    '/inventory/stock_adjust/create',
    '/inventory/stock_adjust/:id/view',
    '/inventory/stock_adjust/:id/update')
ON CONFLICT (role_id, module_id) DO NOTHING;
