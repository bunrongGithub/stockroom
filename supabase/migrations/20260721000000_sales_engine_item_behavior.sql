-- ── Sales Engine × Item Behavior ─────────────────────────────────────────────
-- Enables mixed item classes (stock / non_stock / service) on one sales
-- workflow. See service/core/item-behavior.ts for the behavior registry.
--
-- 1. sales_order_items.item_class — behavior snapshot per line. In-flight
--    documents keep behaving as sold even if the item master changes later.
-- 2. sales_order_items.invoiced_qty — fulfillment counter for direct-invoice
--    lines, mirroring the shipped_qty pattern (incremented on invoice post,
--    recomputable from invoice lines).
-- 3. sales_invoice.shipment_id becomes nullable — direct-invoice lines are
--    invoiced straight from the order; a CHECK keeps every invoice anchored
--    to at least one source document.
-- 4. sales_order.warehouse_id becomes nullable — orders with no shippable
--    lines have no warehouse. "Required iff shippable lines exist" is
--    enforced app-side via the behavior registry.

-- 1. Line class snapshot
ALTER TABLE sales_order_items
    ADD COLUMN IF NOT EXISTS item_class varchar(20);

UPDATE sales_order_items soi
SET item_class = ii.item_class
FROM inventory_item ii
WHERE ii.id = soi.item_id AND soi.item_class IS NULL;

UPDATE sales_order_items SET item_class = 'stock' WHERE item_class IS NULL;

ALTER TABLE sales_order_items
    ALTER COLUMN item_class SET DEFAULT 'stock',
    ALTER COLUMN item_class SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sales_order_items_item_class_check'
    ) THEN
        ALTER TABLE sales_order_items
            ADD CONSTRAINT sales_order_items_item_class_check
            CHECK (item_class IN ('stock', 'non_stock', 'service'));
    END IF;
END $$;

-- 2. Direct-invoice fulfillment counter
ALTER TABLE sales_order_items
    ADD COLUMN IF NOT EXISTS invoiced_qty numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sales_order_items_invoiced_qty_check'
    ) THEN
        ALTER TABLE sales_order_items
            ADD CONSTRAINT sales_order_items_invoiced_qty_check
            CHECK (invoiced_qty >= 0 AND invoiced_qty <= ordered_qty);
    END IF;
END $$;

-- 3. Invoice may source from a shipment, an order, or both — never neither
ALTER TABLE sales_invoice ALTER COLUMN shipment_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sales_invoice_source_check'
    ) THEN
        ALTER TABLE sales_invoice
            ADD CONSTRAINT sales_invoice_source_check
            CHECK (shipment_id IS NOT NULL OR sales_order_id IS NOT NULL);
    END IF;
END $$;

-- 4. Warehouse only required when the order contains shippable lines
ALTER TABLE sales_order ALTER COLUMN warehouse_id DROP NOT NULL;
