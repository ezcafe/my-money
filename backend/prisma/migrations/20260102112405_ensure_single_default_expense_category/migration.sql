-- Ensure exactly one "Default Expense Category" exists
-- If none exists, create one. If multiple exist, keep the oldest and delete the rest.

-- First, delete all but the oldest one (if multiple exist)
DELETE FROM "Category"
WHERE "name" = 'Default Expense Category'
  AND "isDefault" = true
  AND "userId" IS NULL
  AND "id" NOT IN (
    SELECT "id" FROM "Category"
    WHERE "name" = 'Default Expense Category'
      AND "isDefault" = true
      AND "userId" IS NULL
    ORDER BY "createdAt" ASC
    LIMIT 1
  );

-- Then, if none exists, create one
INSERT INTO "Category" ("id", "name", "type", "isDefault", "userId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'Default Expense Category',
  'EXPENSE',
  true,
  NULL,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Category"
  WHERE "name" = 'Default Expense Category'
    AND "isDefault" = true
    AND "userId" IS NULL
    AND "type" = 'EXPENSE'
);






