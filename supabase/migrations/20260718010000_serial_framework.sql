-- ═══════════════════════════════════════════════════════════════════════════
-- Serial Number Management Framework
--   • serial_number_config  — per-company generation settings (strategy,
--     prefix/suffix, padding, start, reset rule, custom pattern).
--   • serial_sequence       — atomic counters. scope_key encodes what the
--     counter is scoped to (reset period, item, …) so ONE table serves every
--     strategy; next_serial_block reserves N numbers in a single upsert
--     (concurrent generators can never receive overlapping blocks).
--   • inventory_item.serial_generation — per-item entry mode (manual/auto/both).
--   • Status CHECK gains 'transferred' and 'inactive' for future modules
--     (transfer, warranty/asset) — no behavior change today.
--   • Search indexes: prefix search across statuses + status slices.
--   • Module row: Inventory → Configurations → Serial Numbering settings page.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Per-company generation config ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.serial_number_config (
    company_id    BIGINT PRIMARY KEY
                      REFERENCES public.company(id) ON DELETE CASCADE,
    strategy      VARCHAR(30)  NOT NULL DEFAULT 'sequential',
    prefix        VARCHAR(20)  NOT NULL DEFAULT '',
    suffix        VARCHAR(20)  NOT NULL DEFAULT '',
    seq_length    INT          NOT NULL DEFAULT 8,
    start_number  BIGINT       NOT NULL DEFAULT 1,
    reset_rule    VARCHAR(10)  NOT NULL DEFAULT 'never',
    -- Custom token template, e.g. '{PREFIX}{YYYY}{MM}-{SEQ}'. NULL = use the
    -- preset template of the selected strategy.
    pattern       VARCHAR(100),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_serial_config_strategy CHECK (strategy IN
        ('sequential', 'date_prefix', 'item_prefix', 'warehouse_prefix',
         'company_prefix', 'random', 'custom')),
    CONSTRAINT chk_serial_config_reset CHECK (reset_rule IN
        ('never', 'yearly', 'monthly', 'daily')),
    CONSTRAINT chk_serial_config_seq_length CHECK (seq_length BETWEEN 1 AND 20),
    CONSTRAINT chk_serial_config_start CHECK (start_number >= 1)
);

ALTER TABLE public.serial_number_config ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_serial_number_config_updated_at ON public.serial_number_config;
CREATE TRIGGER trg_serial_number_config_updated_at
    BEFORE UPDATE ON public.serial_number_config
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 2. Atomic sequence counters ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.serial_sequence (
    company_id  BIGINT      NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    scope_key   VARCHAR(80) NOT NULL,
    last_value  BIGINT      NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, scope_key)
);

ALTER TABLE public.serial_sequence ENABLE ROW LEVEL SECURITY;

-- Reserve a block of p_count numbers for (company, scope). Returns the FIRST
-- number of the block; the block is [result, result + p_count - 1]. A single
-- upsert statement — atomic under concurrency, no explicit locking needed.
-- p_start seeds a fresh counter so blocks begin at the configured start number.
CREATE OR REPLACE FUNCTION next_serial_block(
    p_company_id BIGINT,
    p_scope_key  VARCHAR,
    p_count      INT,
    p_start      BIGINT DEFAULT 1
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_last BIGINT;
BEGIN
    IF p_count < 1 OR p_count > 10000 THEN
        RAISE EXCEPTION 'Invalid serial block size: %', p_count;
    END IF;

    INSERT INTO public.serial_sequence (company_id, scope_key, last_value)
    VALUES (p_company_id, p_scope_key, p_start - 1 + p_count)
    ON CONFLICT (company_id, scope_key)
    DO UPDATE SET last_value = public.serial_sequence.last_value + p_count,
                  updated_at = now()
    RETURNING last_value INTO v_last;

    RETURN v_last - p_count + 1;
END;
$$;

-- ── 3. Per-item generation mode ─────────────────────────────────────────────
ALTER TABLE public.inventory_item
    ADD COLUMN IF NOT EXISTS serial_generation VARCHAR(10) NOT NULL DEFAULT 'both';
ALTER TABLE public.inventory_item
    DROP CONSTRAINT IF EXISTS chk_inventory_item_serial_generation;
ALTER TABLE public.inventory_item
    ADD CONSTRAINT chk_inventory_item_serial_generation
    CHECK (serial_generation IN ('manual', 'auto', 'both'));

-- ── 4. Future lifecycle statuses ────────────────────────────────────────────
ALTER TABLE public.inventory_serial DROP CONSTRAINT IF EXISTS chk_inventory_serial_status;
ALTER TABLE public.inventory_serial ADD CONSTRAINT chk_inventory_serial_status
    CHECK (status IN ('available', 'reserved', 'sold', 'returned',
                      'damaged', 'scrapped', 'removed', 'transferred', 'inactive'));

-- ── 5. Search indexes ───────────────────────────────────────────────────────
-- Prefix search (ilike 'X%') across any status for the global serial search.
CREATE INDEX IF NOT EXISTS idx_inventory_serial_search
    ON public.inventory_serial (company_id, serial_number text_pattern_ops);
-- Status-sliced listings (e.g. all 'sold' serials of a company).
CREATE INDEX IF NOT EXISTS idx_inventory_serial_company_status
    ON public.inventory_serial (company_id, status);

-- ── 6. Settings module row: /inventory/configurations/serial-setting ────────
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/inventory/configurations/serial-setting', 'Serial Numbering',
       '/inventory/configurations/serial-setting', 'InventorySerialSetting',
       m.id, 'configuration', 'Barcode', 90, false
FROM modules m
WHERE m.path = '/inventory'
  AND NOT EXISTS (
      SELECT 1 FROM modules x
      WHERE x.path = '/inventory/configurations/serial-setting'
  );

-- Admin-level roles can view/update; adjust per-role later in Role Permissions.
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT r.id, m.id, true, false, true, false, false
FROM roles r
JOIN modules m ON m.path = '/inventory/configurations/serial-setting'
ON CONFLICT (role_id, module_id) DO NOTHING;
