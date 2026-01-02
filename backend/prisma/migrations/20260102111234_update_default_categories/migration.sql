-- Rename Default Category to Default Expense Category
-- Add Default Income Category
-- Remove any stale "Default Category" records
-- This updates existing default category records in the database

-- Update existing "Default Category" to "Default Expense Category"
UPDATE "Category"
SET "name" = 'Default Expense Category'
WHERE "name" = 'Default Category'
  AND "isDefault" = true
  AND "userId" IS NULL
  AND "type" = 'EXPENSE';

-- Insert "Default Income Category" if it doesn't exist
INSERT INTO "Category" ("id", "name", "type", "isDefault", "userId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'Default Income Category',
  'INCOME',
  true,
  NULL,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Category"
  WHERE "name" = 'Default Income Category'
    AND "isDefault" = true
    AND "userId" IS NULL
    AND "type" = 'INCOME'
);

-- Delete any remaining stale "Default Category" records
-- This removes any "Default Category" that wasn't renamed (e.g., user-specific ones or with different types)
DELETE FROM "Category"
WHERE "name" = 'Default Category';

