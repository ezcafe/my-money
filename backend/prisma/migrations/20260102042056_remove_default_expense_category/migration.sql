-- Remove duplicate "Default Expense Category" entries, keeping only one
-- Keep the oldest one (first created) and delete the rest
-- Categories are set to null in transactions when deleted (onDelete: SetNull), so this is safe
DELETE FROM "Category"
WHERE "name" = 'Default Expense Category'
  AND "id" NOT IN (
    SELECT "id" FROM "Category"
    WHERE "name" = 'Default Expense Category'
      AND "isDefault" = true
      AND "userId" IS NULL
    ORDER BY "createdAt" ASC
    LIMIT 1
  );