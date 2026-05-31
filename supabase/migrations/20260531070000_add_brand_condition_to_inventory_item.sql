ALTER TABLE public.inventory_item
  ADD COLUMN IF NOT EXISTS brand     character varying(100) null,
  ADD COLUMN IF NOT EXISTS condition character varying(20)  null
    CHECK (condition IN ('new', 'used', 'refurbished'));


