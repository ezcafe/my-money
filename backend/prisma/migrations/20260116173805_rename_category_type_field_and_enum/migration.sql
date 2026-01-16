-- Rename column from type to categoryType
ALTER TABLE "Category" RENAME COLUMN "type" TO "categoryType";

-- Drop the default constraint temporarily
ALTER TABLE "Category" ALTER COLUMN "categoryType" DROP DEFAULT;

-- Create new enum type with new values
CREATE TYPE "CategoryType_new" AS ENUM ('Income', 'Expense');

-- Alter column to use new enum type, converting old values to new ones
ALTER TABLE "Category" ALTER COLUMN "categoryType" TYPE "CategoryType_new" USING (
  CASE
    WHEN "categoryType"::text = 'INCOME' THEN 'Income'::"CategoryType_new"
    WHEN "categoryType"::text = 'EXPENSE' THEN 'Expense'::"CategoryType_new"
    ELSE 'Expense'::"CategoryType_new"
  END
);

-- Drop old enum type
DROP TYPE "CategoryType";

-- Rename new enum type to original name
ALTER TYPE "CategoryType_new" RENAME TO "CategoryType";

-- Restore default constraint with new enum value
ALTER TABLE "Category" ALTER COLUMN "categoryType" SET DEFAULT 'Expense'::"CategoryType";
