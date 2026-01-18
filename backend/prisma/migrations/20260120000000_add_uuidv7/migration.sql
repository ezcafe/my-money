-- Add UUIDv7 support for timestamp-ordered UUIDs
-- PostgreSQL 18 includes native uuidv7() function support
-- This migration documents the availability and benefits of UUIDv7

-- UUIDv7 provides timestamp-ordered UUIDs which improve:
-- 1. Index performance (reduced fragmentation)
-- 2. Natural ordering by creation time
-- 3. Better cache locality

-- Note: uuidv7() is available natively in PostgreSQL 18
-- No extension installation required

-- Example usage for new tables:
-- CREATE TABLE example (
--   id UUID PRIMARY KEY DEFAULT uuidv7(),
--   ...
-- );

-- For existing tables, we keep uuid() for backward compatibility
-- New tables can optionally use uuidv7() for better performance

-- Verify uuidv7() is available (will error if not on PostgreSQL 18+)
DO $$
BEGIN
  -- Test that uuidv7() function exists
  PERFORM uuidv7();
  RAISE NOTICE 'UUIDv7 support confirmed - uuidv7() function is available';
EXCEPTION
  WHEN undefined_function THEN
    RAISE EXCEPTION 'uuidv7() function not available. PostgreSQL 18+ is required.';
END $$;
