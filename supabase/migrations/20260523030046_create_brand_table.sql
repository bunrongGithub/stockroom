-- supabase/migrations/20260523000000_create_brand_table.sql

create table public.inventory_brand (
  id          bigserial primary key,
  name        text        not null unique,
  reference_no text,
  created_at  timestamptz default now(),
  writed_at   timestamptz
);
