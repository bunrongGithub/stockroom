-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: dev company + super_admin user
-- Password: Admin@123
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.users (email, password_hash, company_id, role)
SELECT
  'admin@example.com',
  crypt('Admin@123', gen_salt('bf', 10)),
  c.id,
  'super_user'
FROM public.company c
WHERE c.domain = 'default'
LIMIT 1;
