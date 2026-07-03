CREATE TABLE IF NOT EXISTS public.inventory_serial (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES public.inventory_item(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) NOT NULL,
    warehouse_id BIGINT NOT NULL REFERENCES public.warehouse(id),
    location_id BIGINT NOT NULL REFERENCES public.warehouse_location(id),
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    receipt_item_id BIGINT REFERENCES public.receipt_items(id),
    sale_item_id BIGINT REFERENCES public.sales_shipment_items(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_serial_company_serial UNIQUE (company_id, serial_number),
    CONSTRAINT chk_inventory_serial_status CHECK (status IN ('available', 'reserved', 'sold', 'returned', 'damaged', 'scrapped'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_serial_company_item ON public.inventory_serial (company_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_serial_status ON public.inventory_serial (status);

CREATE TABLE IF NOT EXISTS public.inventory_serial_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    serial_id BIGINT NOT NULL REFERENCES public.inventory_serial(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL,
    transaction_id BIGINT,
    warehouse_id BIGINT REFERENCES public.warehouse(id),
    location_id BIGINT REFERENCES public.warehouse_location(id),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_serial_history_serial ON public.inventory_serial_history (serial_id, created_at DESC);

ALTER TABLE public.inventory_item ADD COLUMN IF NOT EXISTS track_serial BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.receipt_items
    ADD COLUMN IF NOT EXISTS serial_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sales_shipment_items
    ADD COLUMN IF NOT EXISTS serial_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;
