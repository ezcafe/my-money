-- Add skip-scan indexes for sparse columns (categoryId, payeeId)
-- PostgreSQL 18 skip-scan optimization works with multicolumn B-tree indexes
-- These indexes optimize queries on sparse (nullable) columns

-- Skip-scan indexes for Transaction.categoryId
-- Optimizes queries filtering on categoryId even when it's NULL
-- The existing [categoryId, date] index already supports skip-scan,
-- but we add a dedicated index for categoryId-only queries on sparse data
CREATE INDEX IF NOT EXISTS "transaction_categoryId_skip_scan_idx"
  ON "Transaction" ("categoryId")
  WHERE "categoryId" IS NOT NULL;

-- Skip-scan indexes for Transaction.payeeId
-- Optimizes queries filtering on payeeId even when it's NULL
-- The existing [payeeId, date] index already supports skip-scan,
-- but we add a dedicated index for payeeId-only queries on sparse data
CREATE INDEX IF NOT EXISTS "transaction_payeeId_skip_scan_idx"
  ON "Transaction" ("payeeId")
  WHERE "payeeId" IS NOT NULL;

-- Note: The existing multicolumn indexes [categoryId, date] and [payeeId, date]
-- already benefit from PostgreSQL 18's skip-scan optimization when:
-- - Filtering on 'date' without specifying categoryId/payeeId
-- - The leading column (categoryId/payeeId) has low cardinality
--
-- These new partial indexes (WHERE IS NOT NULL) help with:
-- - Queries that specifically filter on categoryId/payeeId
-- - Reducing index size by excluding NULL values
-- - Better performance for sparse column queries
