-- Align users.role values with user_role.name and add FK
-- user_role has: super_user, admin, staff, member
-- users.role had: super_admin, admin, member, user  (mismatched)

-- 1. Drop the old inline check + default
ALTER TABLE public.users
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Remap any existing rows to the correct role names
UPDATE public.users SET role = 'super_user' WHERE role = 'super_admin';
UPDATE public.users SET role = 'staff'       WHERE role = 'user';

-- 3. Ensure every role value is valid before adding FK
UPDATE public.users SET role = 'staff'
  WHERE role NOT IN (SELECT name FROM public.user_role);

-- 4. Add FK to user_role
ALTER TABLE public.users
  ADD CONSTRAINT users_role_fkey
    FOREIGN KEY (role) REFERENCES public.user_role(name) ON UPDATE CASCADE;

-- 5. Restore default using the canonical role name
ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'staff';
