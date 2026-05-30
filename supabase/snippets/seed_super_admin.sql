-- ─────────────────────────────────────────────────────────────
-- Seed: create first company + super admin user
--
-- Run this once in the Supabase SQL Editor after applying the
-- 20260530000000_replace_profiles_with_users migration.
--
-- pgcrypto is pre-installed on every Supabase project.
-- ─────────────────────────────────────────────────────────────

-- 0. Enable pgcrypto (safe to run even if already enabled)
create extension if not exists pgcrypto;

-- 1. Insert the company (skip if it already exists)
insert into public.company (name, domain)
values ('iCase Services', 'icase.com')
on conflict (name) do nothing;

-- 2. Create the super admin user
--    ⚠️  Change the email and password before running!
insert into public.users (email, password_hash, company_id, role)
values (
    'admin@icase.com',                                   -- ← change email
    crypt('Admin@1234', gen_salt('bf', 12)),             -- ← change password
    (select id from public.company where name = 'iCase Services'),
    'super_admin'
)
on conflict (email) do nothing;

-- 3. Verify
select id, email, role, company_id, created_at
from public.users
where role = 'super_admin';
