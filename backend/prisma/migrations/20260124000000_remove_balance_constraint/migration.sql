-- Remove balance constraint to allow zero or negative balances
-- This enables support for credit cards, loans, and overdraft scenarios
-- The constraint was originally added in:
-- - 20260118000002_add_database_constraints/migration.sql
-- - 20260118055133_add_workspace_system/migration.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Account_balance_check'
  ) THEN
    ALTER TABLE "Account" DROP CONSTRAINT "Account_balance_check";
  END IF;
END $$;
