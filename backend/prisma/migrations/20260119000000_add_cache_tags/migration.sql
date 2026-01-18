-- Add cache tags support for better cache invalidation
-- Add tags column to cache table
ALTER TABLE "cache" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';

-- Create index on tags for efficient tag-based queries
CREATE INDEX IF NOT EXISTS "cache_tags_gin_idx" ON "cache" USING GIN ("tags");
