-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('Cash', 'CreditCard', 'Bank', 'Saving', 'Loans');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'Cash';

-- CreateIndex
CREATE INDEX "Account_userId_accountType_idx" ON "Account"("userId", "accountType");

-- Data migration: Auto-detect accountType from existing account names
UPDATE "Account"
SET "accountType" = CASE
  WHEN LOWER("name") LIKE '%cash%' THEN 'Cash'::"AccountType"
  WHEN LOWER("name") LIKE '%card%' OR LOWER("name") LIKE '%credit%' THEN 'CreditCard'::"AccountType"
  WHEN LOWER("name") LIKE '%bank%' THEN 'Bank'::"AccountType"
  WHEN LOWER("name") LIKE '%saving%' OR LOWER("name") LIKE '%savings%' THEN 'Saving'::"AccountType"
  WHEN LOWER("name") LIKE '%loan%' THEN 'Loans'::"AccountType"
  ELSE 'Cash'::"AccountType"
END;
