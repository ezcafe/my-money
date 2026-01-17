-- Create UNLOGGED token_revocation table for high-performance token revocation checks
-- UNLOGGED tables skip WAL for faster writes (acceptable for revocation data)
CREATE UNLOGGED TABLE IF NOT EXISTS "token_revocation" (
    "key" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "token_revocation_pkey" PRIMARY KEY ("key")
);

-- Create index on expires_at for efficient cleanup queries
CREATE INDEX IF NOT EXISTS "token_revocation_expires_at_idx" ON "token_revocation"("expires_at");
