-- ============================================================================
-- inventory_item_uom — reconcile pre-existing data before the rules land.
--
-- 20260808100000_item_uom_multi.sql adds the constraints that make an item UOM
-- well-formed (one row per unit, one base per item). Nothing enforced those
-- before, so a database that has been in use can hold rows that violate them —
-- and the CREATE UNIQUE INDEX then fails mid-migration:
--
--     ERROR: could not create unique index "uq_item_uom_item_uom"
--     Key (item_id, uom_id)=(7, 6) is duplicated.
--
-- This runs first and clears the two violations that can be resolved without
-- judgement, and REFUSES — loudly, with the offending rows named — the two that
-- cannot. A wrong guess here would silently restate historical documents, so
-- failing the push is the correct outcome.
--
-- Deliberately order-independent and idempotent: it is a no-op on a database
-- that is already clean, so it is safe whether it runs before the rest (a
-- remote that has none of this yet) or after them (a local that already
-- applied them). It therefore touches ONLY columns that exist in both states —
-- id, item_id, uom_id, is_default, conversion — and never `factor`,
-- `conversion_type` or `base_factor`.
-- ============================================================================

-- ── 1. Refuse duplicates that disagree ──────────────────────────────────────
-- Same item, same unit, different conversion: there is no safe winner. Merging
-- would redenominate every document that referenced the losing row.
DO $$
DECLARE
    v_offenders text;
BEGIN
    SELECT string_agg(format('item %s / uom %s', item_id, uom_id), ', ')
      INTO v_offenders
      FROM (
          SELECT item_id, uom_id
            FROM public.inventory_item_uom
           GROUP BY item_id, uom_id
          HAVING count(*) > 1
             AND count(DISTINCT COALESCE(conversion, 1)) > 1
      ) d;

    IF v_offenders IS NOT NULL THEN
        RAISE EXCEPTION
            'Duplicate item UOM rows disagree on their conversion (%). Merge or '
            'delete them by hand first: picking one automatically would restate '
            'the historical documents that reference the other.', v_offenders;
    END IF;
END $$;

-- ── 2. Refuse a base row that is not 1 ──────────────────────────────────────
-- chk_item_uom_base_is_one is about to require it, and "the base unit is worth
-- 5 of itself" is a data error only a human can interpret.
DO $$
DECLARE
    v_offenders text;
BEGIN
    SELECT string_agg(format('item_uom %s (item %s, conversion %s)',
                             id, item_id, conversion), ', ')
      INTO v_offenders
      FROM public.inventory_item_uom
     WHERE is_default
       AND COALESCE(conversion, 1) <> 1;

    IF v_offenders IS NOT NULL THEN
        RAISE EXCEPTION
            'These base UOM rows have a conversion other than 1 (%). The base '
            'unit defines what stock is counted in, so it is always 1 — correct '
            'the data or demote the row to an alternate unit first.', v_offenders;
    END IF;
END $$;

-- ── 3. Merge exact duplicates ───────────────────────────────────────────────
-- Past this point every duplicate group shares one conversion, so the rows are
-- interchangeable and collapsing them cannot change any quantity. The base row
-- wins where there is one, otherwise the oldest.
-- Plain temp table, explicitly dropped at the end rather than ON COMMIT DROP:
-- that variant is discarded immediately if the runner applies statements in
-- autocommit rather than one transaction per file, which would leave the DO
-- block below querying a table that no longer exists.
DROP TABLE IF EXISTS _item_uom_merge;
CREATE TEMP TABLE _item_uom_merge AS
SELECT id AS loser_id, winner_id
  FROM (
      SELECT id,
             first_value(id) OVER (
                 PARTITION BY item_id, uom_id
                 ORDER BY is_default DESC, id
             ) AS winner_id
        FROM public.inventory_item_uom
  ) ranked
 WHERE id <> winner_id;

-- Repoint every table that references an item UOM. Discovered from the
-- catalogue rather than hardcoded, because sales_invoice_items only gains its
-- item_uom_id in the next migration — so the set legitimately differs between
-- a remote running this first and a local running it last.
DO $$
DECLARE
    v_table text;
    v_moved bigint;
    v_total bigint := 0;
BEGIN
    FOR v_table IN
        SELECT c.table_name
          FROM information_schema.columns c
          JOIN information_schema.tables t
            ON t.table_schema = c.table_schema
           AND t.table_name = c.table_name
           AND t.table_type = 'BASE TABLE'
         WHERE c.table_schema = 'public'
           AND c.column_name = 'item_uom_id'
         ORDER BY c.table_name
    LOOP
        EXECUTE format(
            'UPDATE public.%I li
                SET item_uom_id = m.winner_id
               FROM _item_uom_merge m
              WHERE li.item_uom_id = m.loser_id', v_table);
        GET DIAGNOSTICS v_moved = ROW_COUNT;
        v_total := v_total + v_moved;
        IF v_moved > 0 THEN
            RAISE NOTICE 'item UOM dedupe: repointed % row(s) in %', v_moved, v_table;
        END IF;
    END LOOP;

    RAISE NOTICE 'item UOM dedupe: % document line(s) repointed in total', v_total;
END $$;

DELETE FROM public.inventory_item_uom iu
 USING _item_uom_merge m
 WHERE iu.id = m.loser_id;

-- ── 4. Demote extra base rows ───────────────────────────────────────────────
-- uq_item_uom_one_base allows exactly one. The item master already records the
-- real base in inventory_item.uom_id, so that row is kept and the others become
-- ordinary alternates — which, at conversion 1, means exactly what they meant
-- before. No document changes value.
WITH ranked AS (
    SELECT iu.id,
           row_number() OVER (
               PARTITION BY iu.item_id
               ORDER BY (iu.uom_id IS NOT DISTINCT FROM i.uom_id) DESC, iu.id
           ) AS rn
      FROM public.inventory_item_uom iu
      LEFT JOIN public.inventory_item i ON i.id = iu.item_id
     WHERE iu.is_default
)
UPDATE public.inventory_item_uom u
   SET is_default = false
  FROM ranked r
 WHERE u.id = r.id
   AND r.rn > 1;

DROP TABLE IF EXISTS _item_uom_merge;
