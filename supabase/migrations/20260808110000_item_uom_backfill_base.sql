-- ============================================================================
-- Backfill the missing base UOM rows.
--
-- Rule 1 says every stock item has exactly one base UOM, but the row was only
-- ever created by the stock-item create/update path — items that predate it, or
-- that were created another way, have none. Four of eighteen were missing one.
--
-- Without a base row the conversion layer has nothing to anchor to: an item's
-- only row would be treated as its own base, so "5 Box" would resolve to
-- "60 Box" instead of "60 Piece". Any alternate UOM added to such an item is
-- silently wrong.
--
-- `inventory_item.uom_id` already records the intended base unit, so the row can
-- be reconstructed exactly. Idempotent.
-- ============================================================================

INSERT INTO public.inventory_item_uom (
    name, display_name, item_id, uom_id, company_id,
    is_default, conversion, conversion_type, factor, is_active
)
SELECT
    u.name,
    u.display_name,
    i.id,
    i.uom_id,
    i.company_id,
    true,
    1,
    'MULTIPLY',
    1,
    true
FROM public.inventory_item i
JOIN public.inventory_uom u ON u.id = i.uom_id
WHERE i.uom_id IS NOT NULL
  AND i.company_id IS NOT NULL
  -- no base row yet
  AND NOT EXISTS (
      SELECT 1 FROM public.inventory_item_uom iu
       WHERE iu.item_id = i.id AND iu.is_default
  )
  -- and the base unit is not already present as an alternate, which would
  -- collide with uq_item_uom_item_uom
  AND NOT EXISTS (
      SELECT 1 FROM public.inventory_item_uom iu
       WHERE iu.item_id = i.id AND iu.uom_id = i.uom_id
  );

-- An alternate row that happens to sit on the item's own base unit is really
-- the base row; promote it rather than leaving the item without one.
UPDATE public.inventory_item_uom iu
   SET is_default = true, conversion = 1, conversion_type = 'MULTIPLY'
  FROM public.inventory_item i
 WHERE i.id = iu.item_id
   AND iu.uom_id = i.uom_id
   AND NOT iu.is_default
   AND NOT EXISTS (
       SELECT 1 FROM public.inventory_item_uom d
        WHERE d.item_id = iu.item_id AND d.is_default
   );
