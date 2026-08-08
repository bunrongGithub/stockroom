-- ============================================================================
-- Multi-UOM per stock item — schema, constraints and history snapshots.
--
-- inventory_item_uom already existed and five transaction line tables already
-- reference it, but every row was is_default with conversion = 1 and nothing
-- enforced the business rules. This migration finishes it:
--
--   1. Exact arithmetic     conversion real(float4) → numeric(18,6)
--   2. Conversion direction  new conversion_type MULTIPLY | DIVIDE
--   3. One canonical factor  generated base_factor = the resolved multiplier,
--                            so no module ever branches on the enum
--   4. Business rules        one base per item, no duplicate UOM, conversion > 0,
--                            base is always exactly 1
--   5. Tenant isolation      company_id NOT NULL + a trigger asserting the item,
--                            the UOM and the row all share a company
--   6. History               conversion_factor snapshot on the four line tables
--                            that lacked one (receipt_items already had it)
--   7. Audit                 created_by / updated_by / updated_at, matching the
--                            project convention
--
-- Backward compatible by construction: every existing row is conversion = 1 and
-- every snapshot column defaults to 1, so all existing documents and balances
-- keep their exact current meaning.
-- ============================================================================

-- ── M1. Conversion direction, activation flag, audit columns ────────────────
ALTER TABLE public.inventory_item_uom
    ADD COLUMN IF NOT EXISTS conversion_type text NOT NULL DEFAULT 'MULTIPLY',
    ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
    ALTER TABLE public.inventory_item_uom
        ADD CONSTRAINT chk_item_uom_conversion_type
        CHECK (conversion_type IN ('MULTIPLY', 'DIVIDE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keep updated_at fresh with the shared trigger fn from the audit framework.
DROP TRIGGER IF EXISTS trg_inventory_item_uom_updated_at ON public.inventory_item_uom;
CREATE TRIGGER trg_inventory_item_uom_updated_at
    BEFORE UPDATE ON public.inventory_item_uom
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── M2. Exact conversion arithmetic ─────────────────────────────────────────
-- `factor` was a second column holding the same number; collapse onto
-- `conversion` and leave `factor` in place until the code stops reading it.
UPDATE public.inventory_item_uom
   SET conversion = COALESCE(conversion, factor, 1)
 WHERE conversion IS NULL OR conversion <= 0;

ALTER TABLE public.inventory_item_uom
    ALTER COLUMN conversion TYPE numeric(18,6) USING ROUND(conversion::numeric, 6),
    ALTER COLUMN conversion SET DEFAULT 1,
    ALTER COLUMN conversion SET NOT NULL;

-- ── M3. The one number every module multiplies by ───────────────────────────
-- Mirrors toBaseFactor() in service/core/uom-conversion.ts. Generated, so the
-- database and the application can never disagree.
ALTER TABLE public.inventory_item_uom
    ADD COLUMN IF NOT EXISTS base_factor numeric(18,6)
    GENERATED ALWAYS AS (
        CASE WHEN conversion_type = 'DIVIDE'
             THEN ROUND(1.0 / NULLIF(conversion, 0), 6)
             ELSE conversion
        END
    ) STORED;

-- ── M4. Tenant column ───────────────────────────────────────────────────────
UPDATE public.inventory_item_uom iu
   SET company_id = i.company_id
  FROM public.inventory_item i
 WHERE i.id = iu.item_id
   AND iu.company_id IS NULL;

-- Orphans (no item, no company) cannot be scoped and are not referenced by any
-- transaction; drop them rather than block the NOT NULL.
DELETE FROM public.inventory_item_uom WHERE company_id IS NULL;

ALTER TABLE public.inventory_item_uom
    ALTER COLUMN company_id SET NOT NULL;

-- ── M5. Business rules ──────────────────────────────────────────────────────
DO $$ BEGIN
    ALTER TABLE public.inventory_item_uom
        ADD CONSTRAINT chk_item_uom_conversion_positive CHECK (conversion > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The base row is the definition of "one base unit" — it can only be 1.
DO $$ BEGIN
    ALTER TABLE public.inventory_item_uom
        ADD CONSTRAINT chk_item_uom_base_is_one
        CHECK (NOT is_default OR (conversion = 1 AND conversion_type = 'MULTIPLY'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rule 3 + 4: a UOM appears at most once per item, which also stops the base
-- UOM being re-added in the details list.
CREATE UNIQUE INDEX IF NOT EXISTS uq_item_uom_item_uom
    ON public.inventory_item_uom (item_id, uom_id);

-- Rule 1: exactly one base UOM per item.
CREATE UNIQUE INDEX IF NOT EXISTS uq_item_uom_one_base
    ON public.inventory_item_uom (item_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_item_uom_item ON public.inventory_item_uom (item_id);

-- ── M6. Conversion snapshots on transaction lines ───────────────────────────
-- receipt_items.conversion_factor already existed; this extends the same
-- pattern to the other four so a document can always be re-read with the
-- conversion that was in force when it was saved. DEFAULT 1 is what makes
-- every existing row correct without a backfill.
ALTER TABLE public.sales_order_items
    ADD COLUMN IF NOT EXISTS conversion_factor numeric(18,6) NOT NULL DEFAULT 1;
ALTER TABLE public.sales_shipment_items
    ADD COLUMN IF NOT EXISTS conversion_factor numeric(18,6) NOT NULL DEFAULT 1;
ALTER TABLE public.stock_adjustment_items
    ADD COLUMN IF NOT EXISTS conversion_factor numeric(18,6) NOT NULL DEFAULT 1;
ALTER TABLE public.stock_count_items
    ADD COLUMN IF NOT EXISTS conversion_factor numeric(18,6) NOT NULL DEFAULT 1;

-- Invoices do not move stock, but they print a quantity and a unit — carry the
-- same context so a Box order prints as Box.
ALTER TABLE public.sales_invoice_items
    ADD COLUMN IF NOT EXISTS item_uom_id bigint REFERENCES public.inventory_item_uom (id),
    ADD COLUMN IF NOT EXISTS conversion_factor numeric(18,6) NOT NULL DEFAULT 1;

-- ── M7. Tenant isolation across tables ──────────────────────────────────────
-- Defence in depth: holds even if a future service forgets to check.
CREATE OR REPLACE FUNCTION public.fn_assert_item_uom_same_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item_company bigint;
    v_uom_company  bigint;
BEGIN
    SELECT company_id INTO v_item_company FROM inventory_item WHERE id = NEW.item_id;
    SELECT company_id INTO v_uom_company  FROM inventory_uom  WHERE id = NEW.uom_id;

    IF v_item_company IS NOT NULL AND NEW.company_id <> v_item_company THEN
        RAISE EXCEPTION 'Item UOM company (%) does not match the item''s company (%)',
            NEW.company_id, v_item_company;
    END IF;

    IF v_uom_company IS NOT NULL AND NEW.company_id <> v_uom_company THEN
        RAISE EXCEPTION 'UOM % belongs to another company and cannot be attached to this item',
            NEW.uom_id;
    END IF;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_item_uom_same_company ON public.inventory_item_uom;
CREATE TRIGGER trg_item_uom_same_company
    BEFORE INSERT OR UPDATE ON public.inventory_item_uom
    FOR EACH ROW EXECUTE FUNCTION public.fn_assert_item_uom_same_company();

-- ── Documentation ───────────────────────────────────────────────────────────
COMMENT ON COLUMN public.inventory_item_uom.conversion IS
    'Magnitude of the relationship to the base UOM. Always > 0; always 1 on the base row.';
COMMENT ON COLUMN public.inventory_item_uom.conversion_type IS
    'MULTIPLY: base = entered x conversion (alternate unit is larger, 1 Box = 10 Piece). '
    'DIVIDE: base = entered / conversion (alternate unit is smaller, 10 Piece = 1 Box).';
COMMENT ON COLUMN public.inventory_item_uom.base_factor IS
    'Generated canonical multiplier: base_qty = entered_qty * base_factor. '
    'Mirrors toBaseFactor() in service/core/uom-conversion.ts.';
COMMENT ON COLUMN public.sales_order_items.conversion_factor IS
    'base_factor captured when the line was saved. Preferred over the live item '
    'UOM row so editing a conversion never rewrites historical quantities.';
