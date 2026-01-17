-- Add indexes for pagination optimization
-- These indexes support efficient ordering by value, category, and payee

-- Index for ordering by value (descending/ascending)
CREATE INDEX IF NOT EXISTS "Transaction_userId_value_idx" ON "Transaction"("userId", "value" DESC);

-- Index for ordering by category (requires join, but index on categoryId helps)
-- The existing userId_categoryId_date index helps, but add value ordering too
CREATE INDEX IF NOT EXISTS "Transaction_userId_categoryId_value_idx" ON "Transaction"("userId", "categoryId", "value" DESC);

-- Index for ordering by payee (similar to category)
CREATE INDEX IF NOT EXISTS "Transaction_userId_payeeId_value_idx" ON "Transaction"("userId", "payeeId", "value" DESC);

-- Composite index for date + value ordering (common pattern)
CREATE INDEX IF NOT EXISTS "Transaction_userId_date_value_idx" ON "Transaction"("userId", "date" DESC, "value" DESC);
