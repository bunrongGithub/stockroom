-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: dev users via Supabase Auth + profiles + user_role
--
-- Users created:
--   admin@example.com   / Admin@123   → super_admin  (company: Default)
--   staff@example.com   / Admin@123   → staff        (company: Default)
--   member@example.com  / Admin@123   → member       (company: Default)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  uid_admin    uuid   := '11111111-1111-1111-1111-111111111111';
  uid_staff    uuid   := '22222222-2222-2222-2222-222222222222';
  uid_member   uuid   := '33333333-3333-3333-3333-333333333333';
  v_cid        bigint;
  v_role_super bigint;
  v_role_staff bigint;
  v_role_member bigint;
BEGIN
  -- Resolve company id
  SELECT id INTO v_cid FROM public.company WHERE domain = 'default' LIMIT 1;

  -- Resolve role ids
  SELECT id INTO v_role_super  FROM public.roles WHERE name = 'super_admin';
  SELECT id INTO v_role_staff  FROM public.roles WHERE name = 'staff';
  SELECT id INTO v_role_member FROM public.roles WHERE name = 'member';

  -- ── 1. Auth users ──────────────────────────────────────────────────────────
  -- Direct insert into auth.users is safe for local dev / supabase db reset.
  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin,
    confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES
    (
      '00000000-0000-0000-0000-000000000000', uid_admin,
      'authenticated', 'authenticated',
      'admin@example.com',
      crypt('Admin@123', gen_salt('bf', 10)),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Admin User"}',
      false, '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', uid_staff,
      'authenticated', 'authenticated',
      'staff@example.com',
      crypt('Admin@123', gen_salt('bf', 10)),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Staff User"}',
      false, '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', uid_member,
      'authenticated', 'authenticated',
      'member@example.com',
      crypt('Admin@123', gen_salt('bf', 10)),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Member User"}',
      false, '', '', '', ''
    )
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. Profiles (auth user → company) ─────────────────────────────────────
  INSERT INTO public.profiles (id, company_id, full_name) VALUES
    (uid_admin,  v_cid, 'Admin User'),
    (uid_staff,  v_cid, 'Staff User'),
    (uid_member, v_cid, 'Member User')
  ON CONFLICT (id) DO NOTHING;

  -- ── 3. Role assignments ────────────────────────────────────────────────────
  INSERT INTO public.user_role (user_id, role_id, company_id)
  VALUES (uid_admin, v_role_super, v_cid)
  ON CONFLICT (user_id, role_id, company_id) DO NOTHING;

  INSERT INTO public.user_role (user_id, role_id, company_id)
  VALUES (uid_staff, v_role_staff, v_cid)
  ON CONFLICT (user_id, role_id, company_id) DO NOTHING;

  INSERT INTO public.user_role (user_id, role_id, company_id)
  VALUES (uid_member, v_role_member, v_cid)
  ON CONFLICT (user_id, role_id, company_id) DO NOTHING;

END $$;
