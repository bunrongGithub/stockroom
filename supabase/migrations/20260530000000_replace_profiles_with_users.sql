-- ─────────────────────────────────────────────────────────────
-- Migration: replace Supabase-Auth-backed profiles with a
--            custom users table for the bcrypt + JWT architecture.
--
-- Before running:
--   1. Export any existing profile data you want to keep.
--   2. Ensure the company table already exists.
-- ─────────────────────────────────────────────────────────────

-- 1. Drop old auth triggers + helper functions
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.my_company_id() cascade;

-- 2. Drop old RLS policies that depended on those functions
drop policy if exists "tenant_isolation" on public.inventory_item_category;

-- 3. Drop profiles (cascades any FKs pointing at it)
drop table if exists public.profiles cascade;

-- 4. Create the new users table
create table if not exists public.users (
    id            uuid        primary key default gen_random_uuid(),
    email         text        not null unique,
    password_hash text        not null,
    company_id    bigint      references public.company(id) on delete set null,
    role          text        not null default 'user'
                              check (role in ('super_admin', 'admin', 'member', 'user')),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- 5. Index for the login lookup (lookupUser queries by email)
create index if not exists users_email_idx on public.users (email);

-- 6. Re-add tenant isolation on inventory_item_category using app-layer
--    company_id column instead of the dropped my_company_id() function.
--    RLS is disabled; enforcement is done in the Next.js middleware via
--    the x-company-id request header + createScopedClient().
alter table public.inventory_item_category disable row level security;
