-- Add is_initial_data flag to modules.
-- true  → the catch-all page should server-prefetch paginated data and pass it
--         as initialData/initialMeta to the module component.
-- false → the module is a nav hub, a form, or fetches its own data client-side;
--         no server-side list fetch should be made.

ALTER TABLE public.modules
    ADD COLUMN IF NOT EXISTS is_initial_data boolean NOT NULL DEFAULT false;

-- Mark the modules that currently use server-prefetched list data.
UPDATE public.modules SET is_initial_data = true
WHERE component IN ('InventoryCategoryModule');
