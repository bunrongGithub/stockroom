-- ============================================================================
-- Delivery Note: align the module path with the URL the app actually uses.
--
-- The module row was keyed '/sale/delivery-note' but carried path
-- '/sale/shipment'. Every button in the app (and every child action row —
-- /sale/delivery-note/create, /:id/view, /:id/update) points at
-- /sale/delivery-note, so that URL resolved to NO module and returned 404,
-- while the sidebar sent users to /sale/shipment instead.
--
-- Idempotent: safe to re-run.
-- ============================================================================

UPDATE modules
   SET path = '/sale/delivery-note'
 WHERE key = '/sale/delivery-note'
   AND path = '/sale/shipment';
