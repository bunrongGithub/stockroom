-- Step 1: Add column WITHOUT default (nullable first)
ALTER TABLE roles
  ADD COLUMN company_id integer REFERENCES company(id) ON DELETE CASCADE;

-- Step 2: Backfill existing rows (set real company_id per your data)
UPDATE roles SET company_id = 1 WHERE company_id IS NULL;

-- Step 3: Enforce NOT NULL after backfill
ALTER TABLE roles ALTER COLUMN company_id SET NOT NULL;

-- Step 4: Index
CREATE INDEX idx_roles_company_id ON roles(company_id);
