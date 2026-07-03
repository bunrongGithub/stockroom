-- Carry the customer phone from the Sales Order onto the Shipment, mirroring the
-- existing customer_name snapshot so a delivery document has full contact info.
ALTER TABLE public.sales_shipment
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
