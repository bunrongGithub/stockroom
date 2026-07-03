-- Partial invoicing: a shipment can be split across multiple invoices, so its
-- status is derived from invoiced vs shipped quantity, not from invoice existence.
ALTER TABLE public.sales_shipment DROP CONSTRAINT IF EXISTS chk_sales_shipment_status;
ALTER TABLE public.sales_shipment ADD CONSTRAINT chk_sales_shipment_status
    CHECK (status IN ('DRAFT', 'POSTED', 'VOID', 'INVOICED', 'PARTIALLY_INVOICED'));
