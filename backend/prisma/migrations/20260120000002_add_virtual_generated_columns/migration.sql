-- Add virtual generated columns for computed fields
-- PostgreSQL 18 supports virtual generated columns (STORED and VIRTUAL)
-- These columns are computed from other columns and can improve query performance

-- Add year_month virtual generated column to Transaction table
-- This column extracts year-month from the date for easier grouping in reports
-- Using STORED type for better query performance (computed once, stored)
-- Note: Using EXTRACT and string concatenation instead of TO_CHAR because
-- TO_CHAR is STABLE (depends on locale) but generated columns require IMMUTABLE expressions
ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "year_month" TEXT
  GENERATED ALWAYS AS (
    EXTRACT(YEAR FROM "date")::text || '-' || 
    LPAD(EXTRACT(MONTH FROM "date")::text, 2, '0')
  ) STORED;

-- Create index on year_month for efficient date range queries
CREATE INDEX IF NOT EXISTS "transaction_year_month_idx"
  ON "Transaction" ("year_month");

-- Note: Virtual generated columns (GENERATED ALWAYS AS ... VIRTUAL) are not yet
-- fully supported in PostgreSQL 18 for all use cases. We use STORED here which
-- computes the value once and stores it, trading some storage for query performance.
--
-- Benefits:
-- 1. Faster date grouping queries (no need to extract year-month in queries)
-- 2. Can be indexed for efficient filtering
-- 3. Consistent date formatting across the application
--
-- Example usage:
-- SELECT * FROM "Transaction" WHERE "year_month" = '2025-01';
-- SELECT "year_month", SUM("value") FROM "Transaction" GROUP BY "year_month";
