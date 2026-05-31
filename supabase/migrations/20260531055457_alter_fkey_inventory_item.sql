-- Re-point all user_id FKs from auth.users → public.users
-- (auth.users is no longer used; the app now has its own public.users table)

ALTER TABLE public.inventory_item_category
  DROP CONSTRAINT IF EXISTS inventory_item_category_user_id_fkey,
  ADD CONSTRAINT inventory_item_category_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_item
  DROP CONSTRAINT IF EXISTS inventory_item_user_id_fkey,
  ADD CONSTRAINT inventory_item_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_stock_balance
  DROP CONSTRAINT IF EXISTS inventory_stock_balance_user_id_fkey,
  ADD CONSTRAINT inventory_stock_balance_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_branch
  DROP CONSTRAINT IF EXISTS user_branch_user_id_fkey,
  ADD CONSTRAINT user_branch_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
