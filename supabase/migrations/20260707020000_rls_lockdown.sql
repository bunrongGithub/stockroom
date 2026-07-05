-- ═══════════════════════════════════════════════════════════════════════════
-- RLS lockdown — deny-all for anon/authenticated PostgREST access.
--
-- This app enforces tenancy in the application layer: every server query
-- runs through the service-role client (which BYPASSES row level security),
-- and the browser client uses the anon key for AUTH ONLY (verified: zero
-- `.from()` usages). Without RLS, the anon key shipped in the browser bundle
-- would read/write every table through Supabase's public REST API in
-- production.
--
-- Enabling RLS with NO policies = deny-all for anon/authenticated, no-op for
-- the service role. No app behavior changes. Do NOT add FORCE (that would
-- also block the table owner used by internal maintenance).
--
-- When adding a table, copy this line into its migration:
--   ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.adjustment_reason         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_allocation       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequence         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balance_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_item            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_item_category   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_item_uom        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_serial          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_serial_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_uom             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_transaction       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_module_permission    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_shipment            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_shipment_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_location        ENABLE ROW LEVEL SECURITY;
