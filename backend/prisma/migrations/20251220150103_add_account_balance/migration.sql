-- AlterTable
ALTER TABLE "Account" ADD COLUMN "balance" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Backfill existing balances: balance = initBalance + sum of all transactions
UPDATE "Account" 
SET "balance" = "initBalance" + COALESCE(
  (SELECT SUM("value") FROM "Transaction" WHERE "Transaction"."accountId" = "Account"."id"),
  0
);

