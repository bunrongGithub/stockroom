-- ═══════════════════════════════════════════════════════════════════════════
-- Remove the Stock Count approval gate.
--
-- The product has no approval workflow, so a second person confirming what the
-- counter already recorded was ceremony with nobody to perform it. Finishing a
-- count is now the single action that generates and posts the corrective
-- adjustments: COUNTING → COMPLETED.
--
-- Lifecycle: DRAFT → PREPARED → COUNTING → COMPLETED (+ CANCELLED).
--   • PENDING_APPROVAL rows were submitted but never committed — no adjustment
--     was generated for them, so they go back to COUNTING for the counter to
--     complete.
--   • APPROVED was already dead in the application (approve() wrote COMPLETED
--     directly); any stragglers become COMPLETED.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Migrate existing rows before the constraint tightens ─────────────────
UPDATE stock_count SET status = 'COUNTING'  WHERE status = 'PENDING_APPROVAL';
UPDATE stock_count SET status = 'COMPLETED' WHERE status = 'APPROVED';

ALTER TABLE stock_count DROP CONSTRAINT IF EXISTS chk_stock_count_status;
ALTER TABLE stock_count ADD  CONSTRAINT chk_stock_count_status CHECK (status IN
    ('DRAFT','PREPARED','COUNTING','COMPLETED','CANCELLED'));

-- ── 2. approved_by becomes completed_by ─────────────────────────────────────
-- A rename rather than a drop: the column already held "who committed this
-- count", which is exactly what completed_by means now. approved_at is
-- redundant with completed_at, which was written in the same statement.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'stock_count'
          AND column_name = 'approved_by'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'stock_count'
          AND column_name = 'completed_by'
    ) THEN
        ALTER TABLE stock_count RENAME COLUMN approved_by TO completed_by;
    END IF;
END $$;

-- Backfill completed_at for rows that only carried the approval timestamp,
-- then retire it.
UPDATE stock_count
   SET completed_at = approved_at
 WHERE completed_at IS NULL AND approved_at IS NOT NULL;

ALTER TABLE stock_count DROP COLUMN IF EXISTS approved_at;

-- ── 3. Drop the approve action module row ───────────────────────────────────
-- role_module_permission and role_module_action_permission both reference
-- modules(id) ON DELETE CASCADE, so their grants go with it. Roles keep their
-- 'complete' grant, which was seeded from the same can_update capability, so
-- nobody loses the ability to finish a count.
DELETE FROM modules WHERE path = '/inventory/stock_count/:id/approve';

-- ── 4. Drop the stock_count 'approve' per-action grants ─────────────────────
-- These hang off the /inventory/stock_count module row itself (which stays),
-- so the cascade above does not reach them.
DELETE FROM role_module_action_permission rmap
 USING modules m
 WHERE m.id = rmap.module_id
   AND m.path = '/inventory/stock_count'
   AND rmap.action = 'approve';
