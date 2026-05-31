
alter table if exists public.inventory_item
    add column if not exists is_sellable boolean not null default false,
    add column if not exists is_warranty boolean not null default false,
    add column if not exists warranty_duration character varying(100) null,
    add column if not exists is_returnable boolean not null default false,
    add column if not exists supplier_id bigint null
