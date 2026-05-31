alter table if exists public.inventory_item_uom
  add reference_no character varying(100) null,
  add constraint inventory_item_uom_reference_no_key unique (reference_no);
