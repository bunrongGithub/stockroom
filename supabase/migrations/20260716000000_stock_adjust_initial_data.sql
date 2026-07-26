-- ============================================================================
-- Stock Adjustment list: load its data on the server.
--
-- The module row (/inventory/stock_adjust) had is_initial_data = false, so the
-- page mounted with NO data and no client-side fetch — the list showed empty
-- until an action happened to refresh it. Flip it on; a matching data-registry
-- loader (module path /inventory/stock_adjust ≠ API path /api/inventory/
-- adjustment) loads it in-process, and the page now paginates server-side.
--
-- Idempotent: safe to re-run.
-- ============================================================================

UPDATE modules
   SET is_initial_data = true
 WHERE path = '/inventory/stock_adjust'
   AND is_initial_data = false;
