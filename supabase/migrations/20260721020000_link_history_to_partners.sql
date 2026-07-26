-- ═══════════════════════════════════════════════════════════════════════════
-- Link historical sales documents to their Business Partner.
--
-- Before Master Data, documents stored a free-text customer name (and usually
-- a phone) with no link to any master record — only the Cash Sale path ever
-- wrote customer_id, and only onto the order. This backfills the link so
-- reports, statements and the partner profile can aggregate on an id.
--
-- SAFETY RULES, chosen deliberately:
--   1. Match on the EXACT normalised (lower(name), digits-only phone) pair.
--      No fuzzy matching: attributing one customer's invoices to another is
--      far worse than leaving a document unlinked.
--   2. Only link when the match is UNAMBIGUOUS (exactly one candidate).
--   3. Never touch a document that already has a customer_id.
--   4. Snapshots are never rewritten — an issued invoice keeps the name it
--      was printed with, forever.
-- Unmatched rows stay NULL and are reported in the NOTICE at the end.
--
-- Idempotent: re-running only fills rows that are still NULL.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS _bp_key;
CREATE TEMP TABLE _bp_key AS
SELECT company_id,
       lower(btrim(name))                                 AS name_key,
       coalesce(regexp_replace(phone, '\D', '', 'g'), '') AS phone_key,
       min(id)                                            AS partner_id,
       count(*)                                           AS matches
FROM public.business_partner
GROUP BY 1, 2, 3;

-- Ambiguous keys (two partners with the same name AND phone) are dropped
-- rather than guessed at.
DELETE FROM _bp_key WHERE matches > 1;

UPDATE public.sales_order d
SET customer_id = k.partner_id
FROM _bp_key k
WHERE d.customer_id IS NULL
  AND d.company_id = k.company_id
  AND lower(btrim(d.customer_name)) = k.name_key
  AND coalesce(regexp_replace(d.customer_phone, '\D', '', 'g'), '') = k.phone_key;

-- Shipments and invoices inherit from their parent order when it now has a
-- link — the same relationship, established one document earlier.
UPDATE public.sales_shipment s
SET customer_id = o.customer_id
FROM public.sales_order o
WHERE s.customer_id IS NULL
  AND s.sales_order_id = o.id
  AND o.customer_id IS NOT NULL;

UPDATE public.sales_invoice i
SET customer_id = o.customer_id
FROM public.sales_order o
WHERE i.customer_id IS NULL
  AND i.sales_order_id = o.id
  AND o.customer_id IS NOT NULL;

-- Invoices with no order (none today, but the column allows it) fall back to
-- their own snapshot.
UPDATE public.sales_invoice d
SET customer_id = k.partner_id
FROM _bp_key k
WHERE d.customer_id IS NULL
  AND d.company_id = k.company_id
  AND lower(btrim(d.customer_name)) = k.name_key
  AND coalesce(regexp_replace(d.customer_phone, '\D', '', 'g'), '') = k.phone_key;

UPDATE public.customer_payment d
SET customer_id = k.partner_id
FROM _bp_key k
WHERE d.customer_id IS NULL
  AND d.company_id = k.company_id
  AND lower(btrim(d.customer_name)) = k.name_key
  AND coalesce(regexp_replace(d.customer_phone, '\D', '', 'g'), '') = k.phone_key;

DROP TABLE IF EXISTS _bp_key;

-- What is still unlinked, for the record. These keep their snapshot and remain
-- fully readable; they simply do not roll up into a partner's totals.
DO $$
DECLARE
    v_o int; v_s int; v_i int; v_p int;
BEGIN
    SELECT count(*) INTO v_o FROM public.sales_order      WHERE customer_id IS NULL;
    SELECT count(*) INTO v_s FROM public.sales_shipment   WHERE customer_id IS NULL;
    SELECT count(*) INTO v_i FROM public.sales_invoice    WHERE customer_id IS NULL;
    SELECT count(*) INTO v_p FROM public.customer_payment WHERE customer_id IS NULL;
    RAISE NOTICE 'Unlinked after backfill — orders: %, shipments: %, invoices: %, payments: %',
        v_o, v_s, v_i, v_p;
    RAISE NOTICE 'Unlinked documents keep their name/phone snapshot and stay readable.';
END $$;
