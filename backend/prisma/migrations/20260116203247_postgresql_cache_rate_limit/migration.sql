-- Create UNLOGGED cache table for high-performance caching
-- UNLOGGED tables skip WAL for faster writes (acceptable for cache data)
CREATE UNLOGGED TABLE IF NOT EXISTS "cache" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "cache_pkey" PRIMARY KEY ("key")
);

-- Create index on expires_at for efficient cleanup queries
CREATE INDEX IF NOT EXISTS "cache_expires_at_idx" ON "cache"("expires_at");

-- Create GIN index on JSONB value column for efficient queries (if needed)
CREATE INDEX IF NOT EXISTS "cache_value_gin_idx" ON "cache" USING GIN ("value");

-- Create UNLOGGED rate_limit table for rate limiting
-- UNLOGGED tables skip WAL for faster writes (acceptable for rate limit data)
CREATE UNLOGGED TABLE IF NOT EXISTS "rate_limit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "reset_time" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("key")
);

-- Create index on reset_time for efficient cleanup queries
CREATE INDEX IF NOT EXISTS "rate_limit_reset_time_idx" ON "rate_limit"("reset_time");
