-- Add database CHECK constraints for data integrity
-- These constraints ensure data validity at the database level

-- Account balance must be >= 0
-- Note: This allows negative balances for credit cards, but prevents invalid states
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Account_balance_check'
  ) THEN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_balance_check" CHECK (balance >= 0);
  END IF;
END $$;

-- Transaction value must not be zero
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_value_check'
  ) THEN
    ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_value_check" CHECK (value != 0);
  END IF;
END $$;

-- Budget amount must be positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Budget_amount_check'
  ) THEN
    ALTER TABLE "Budget" ADD CONSTRAINT "Budget_amount_check" CHECK (amount > 0);
  END IF;
END $$;

-- Budget currentSpent must be >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Budget_currentSpent_check'
  ) THEN
    ALTER TABLE "Budget" ADD CONSTRAINT "Budget_currentSpent_check" CHECK ("currentSpent" >= 0);
  END IF;
END $$;

-- RecurringTransaction value must not be zero
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RecurringTransaction_value_check'
  ) THEN
    ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_value_check" CHECK (value != 0);
  END IF;
END $$;

-- BudgetNotification threshold must be between 0 and 100 (percentage)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BudgetNotification_threshold_check'
  ) THEN
    ALTER TABLE "BudgetNotification" ADD CONSTRAINT "BudgetNotification_threshold_check" CHECK (threshold >= 0 AND threshold <= 100);
  END IF;
END $$;
