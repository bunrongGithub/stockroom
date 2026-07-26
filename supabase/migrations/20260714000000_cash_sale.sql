-- ============================================================================
-- Cash Sale — retail counter workflow.
--
-- Cash Sale is NOT a new document type: it orchestrates the existing
-- Sales Order → Shipment → Invoice → Payment chain. Nothing here creates a
-- `cash_sale` table. Everything below is additive:
--
--   1. `customer` master (the system had none — documents stored free text)
--      + nullable customer_id links on the sales documents.
--   2. `company_settings` — the configurable Sales Settings (default sales
--      warehouse / location) the cashier screen reads.
--   3. Widen the payment-method CHECK to accept KHQR (the UI already offers
--      Cambodian wallet methods that the DB was silently rejecting).
--   4. sales_order.source_channel + idempotency_key — identify counter sales
--      and make "Complete Sale" safe to retry / double-click.
--   5. Backfill is_sellable on existing stock items BEFORE the item pickers
--      start filtering on it (otherwise every item would vanish from Sales
--      Order the moment the filter lands).
--   6. Module rows: /sale/cash-sale (register) + /sale/configurations/setting.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── 1. Customer master ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id   BIGINT NOT NULL REFERENCES public.company (id) ON DELETE CASCADE,
    user_id      UUID REFERENCES public.profiles (id),
    name         VARCHAR(200) NOT NULL,
    phone        VARCHAR(50),
    email        VARCHAR(200),
    address      TEXT,
    notes        TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;

-- A customer is identified by name + phone (the pair is unique per company).
-- coalesce() keeps the constraint meaningful for phone-less customers.
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_company_name_phone
    ON public.customer (company_id, lower(name), coalesce(phone, ''));
CREATE INDEX IF NOT EXISTS idx_customer_company_phone
    ON public.customer (company_id, phone);
CREATE INDEX IF NOT EXISTS idx_customer_company_name
    ON public.customer (company_id, lower(name));

DROP TRIGGER IF EXISTS trg_customer_updated_at ON public.customer;
CREATE TRIGGER trg_customer_updated_at
    BEFORE UPDATE ON public.customer
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Documents keep their free-text customer snapshot (a name on a printed
-- invoice must never change retroactively) AND link to the master.
ALTER TABLE public.sales_order
    ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES public.customer (id);
ALTER TABLE public.sales_invoice
    ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES public.customer (id);
ALTER TABLE public.customer_payment
    ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES public.customer (id);

-- ── 2. Company settings (Sales Settings) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_settings (
    company_id                BIGINT PRIMARY KEY
                                  REFERENCES public.company (id) ON DELETE CASCADE,
    default_sales_warehouse_id BIGINT REFERENCES public.warehouse (id),
    default_sales_location_id  BIGINT REFERENCES public.warehouse_location (id),
    -- Room for currency / tax / promotion keys without another migration.
    settings                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER trg_company_settings_updated_at
    BEFORE UPDATE ON public.company_settings
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Seed one row per company from the existing default warehouse/location so the
-- cashier screen works out of the box.
INSERT INTO public.company_settings (company_id, default_sales_warehouse_id, default_sales_location_id)
SELECT c.id,
       w.id,
       (SELECT l.id
          FROM public.warehouse_location l
         WHERE l.warehouse_id = w.id AND l.is_active
         ORDER BY l.is_default DESC, l.id
         LIMIT 1)
FROM public.company c
LEFT JOIN LATERAL (
    SELECT w.id
      FROM public.warehouse w
     WHERE w.company_id = c.id AND w.is_active
     ORDER BY w.is_default DESC, w.id
     LIMIT 1
) w ON true
ON CONFLICT (company_id) DO NOTHING;

-- ── 3. Payment methods: accept KHQR ─────────────────────────────────────────
ALTER TABLE public.customer_payment DROP CONSTRAINT IF EXISTS chk_customer_payment_method;
ALTER TABLE public.customer_payment
    ADD CONSTRAINT chk_customer_payment_method CHECK (
        payment_method IN ('CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'KHQR', 'OTHER')
    );

-- ── 4. Sales order: channel + idempotency ───────────────────────────────────
ALTER TABLE public.sales_order
    ADD COLUMN IF NOT EXISTS source_channel  VARCHAR(20) NOT NULL DEFAULT 'sales_order',
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

ALTER TABLE public.sales_order DROP CONSTRAINT IF EXISTS chk_sales_order_source_channel;
ALTER TABLE public.sales_order
    ADD CONSTRAINT chk_sales_order_source_channel CHECK (
        source_channel IN ('sales_order', 'cash_sale')
    );

-- Replaying the same key returns the original sale instead of selling twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_idempotency
    ON public.sales_order (company_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_order_channel
    ON public.sales_order (company_id, source_channel);

-- ── 5. is_sellable backfill ─────────────────────────────────────────────────
-- `is_sellable` used to mean "show in POS"; nothing ever read it, so every
-- stock item was sellable in practice. Its new meaning is "can be sold through
-- any sales channel (Sales Order, Cash Sale, POS)" — make that true for the
-- items that already are, before the pickers start filtering on the flag.
UPDATE public.inventory_item
   SET is_sellable = true
 WHERE item_class = 'stock' AND is_sellable = false;

-- ── 6. Module rows ──────────────────────────────────────────────────────────
-- The cashier register lives under Sale. It has no list payload of its own
-- (is_initial_data = false): the screen loads its own lookups.
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/sale/cash-sale', 'Cash Sale', '/sale/cash-sale', 'SaleCashSale',
       m.id, 'transaction', 'ShoppingCart', 3, false
FROM modules m
WHERE m.path = '/sale'
  AND NOT EXISTS (SELECT 1 FROM modules x WHERE x.path = '/sale/cash-sale');

-- Sales Settings (default sales warehouse/location) — configuration tab.
INSERT INTO modules (key, label, path, component, parent_id, type, icon, sort_order, is_initial_data)
SELECT '/sale/configurations/setting', 'Settings', '/sale/configurations/setting',
       'SaleSetting', m.id, 'configuration', 'Settings', 1, false
FROM modules m
WHERE m.path = '/sale'
  AND NOT EXISTS (
      SELECT 1 FROM modules x WHERE x.path = '/sale/configurations/setting'
  );

-- Mirror the Sales Order permissions onto the new modules: whoever may sell
-- may use the register.
INSERT INTO role_module_permission (role_id, module_id, can_view, can_create, can_update, can_delete, can_export)
SELECT rmp.role_id, dst.id, rmp.can_view, rmp.can_create, rmp.can_update, rmp.can_delete, rmp.can_export
FROM role_module_permission rmp
JOIN modules src ON src.id = rmp.module_id AND src.path = '/sale/order'
JOIN modules dst ON dst.path IN ('/sale/cash-sale', '/sale/configurations/setting')
ON CONFLICT (role_id, module_id) DO NOTHING;
