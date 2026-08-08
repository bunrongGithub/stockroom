-- ============================================================================
-- inventory_item_uom cleanup — remove the denormalised and contradictory bits.
--
-- Safe to run only now that no code reads these columns: every SELECT embed was
-- rewritten to resolve the unit's name through inventory_uom, which owns it.
--
--   1. name / display_name  duplicated from inventory_uom, so a renamed unit
--                           silently drifted out of sync on every item row
--   2. factor               a second column holding the same number as
--                           conversion, with nothing saying which one wins
--   3. uom_id FK            declared ON DELETE SET NULL on a NOT NULL column —
--                           deleting a UOM raised a not-null violation instead
--                           of a clean referential error
-- ============================================================================

-- ── 1 + 2. Drop the denormalised copies ────────────────────────────────────
ALTER TABLE public.inventory_item_uom
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS display_name,
    DROP COLUMN IF EXISTS factor;

-- ── 3. Make the UOM reference honest ───────────────────────────────────────
-- RESTRICT, not SET NULL: an item UOM without a unit is meaningless, and the
-- UOM master already refuses to delete a unit that is in use.
ALTER TABLE public.inventory_item_uom
    DROP CONSTRAINT IF EXISTS inventory_item_uom_uom_id_fkey;

ALTER TABLE public.inventory_item_uom
    ADD CONSTRAINT inventory_item_uom_uom_id_fkey
    FOREIGN KEY (uom_id) REFERENCES public.inventory_uom (id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

COMMENT ON TABLE public.inventory_item_uom IS
    'The units an item may be transacted in. Exactly one is_default row per '
    'item (the base), always conversion 1. The unit''s name lives on '
    'inventory_uom — never copied here.';
