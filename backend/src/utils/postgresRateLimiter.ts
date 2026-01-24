/**
 * PostgreSQL Rate Limiter
 * Provides distributed rate limiting using PostgreSQL UNLOGGED tables
 * Uses atomic increment operations for thread-safe rate limit checking
 *
 * Performance characteristics:
 * - Atomic operations ensure consistency across instances
 * - UNLOGGED tables for fast writes
 * - Automatic cleanup of expired entries
 */

import {Client} from 'pg';
import {logError, logInfo} from './logger';
import {config} from '../config';

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the window */
  remaining: number;
  /** When the rate limit window resets (timestamp in milliseconds) */
  resetAt: number;
}

/**
 * Check rate limit for a key
 * Uses atomic increment with PostgreSQL INSERT ... ON CONFLICT DO UPDATE
 * @param key - Rate limit key (e.g., IP address or user ID)
 * @param max - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    const now = Date.now();
    const resetTime = new Date(now + windowMs);

    // Use direct pg.Client instead of prisma.$queryRaw (PrismaPg adapter doesn't support it)
    // Atomic increment using PostgreSQL
    // If record doesn't exist, create it with count=1
    // If record exists and window expired, reset it
    // If record exists and window active, increment count
    const client = await getDbClient();
    try {
      const result = await client.query<{
        count: number;
        reset_time: Date;
      }>(
        `INSERT INTO "rate_limit" (key, count, reset_time, created_at)
        VALUES ($1, 1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
          SET count = CASE
            WHEN "rate_limit".reset_time <= NOW() THEN 1
            ELSE "rate_limit".count + 1
          END,
          reset_time = CASE
            WHEN "rate_limit".reset_time <= NOW() THEN $2
            ELSE "rate_limit".reset_time
          END
        RETURNING count, reset_time`,
        [key, resetTime]
      );

      if (result.rows.length === 0 || !result.rows[0]) {
        // Should not happen, but handle gracefully
        return {
          allowed: true,
          remaining: max - 1,
          resetAt: now + windowMs,
        };
      }

      const row = result.rows[0];
      const count = row.count;
      const resetAt = row.reset_time.getTime();

      const allowed = count <= max;
      const remaining = Math.max(0, max - count);

      return {
        allowed,
        remaining,
        resetAt,
      };
    } finally {
      await client.end();
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Rate limit check failed', {
      event: 'rate_limit_check_failed',
      key,
    }, errorObj);

    // On error, allow the request (fail open)
    // This prevents rate limiter failures from breaking the application
    return {
      allowed: true,
      remaining: max,
      resetAt: Date.now() + windowMs,
    };
  }
}

/**
 * Clear expired rate limit entries
 * @returns Number of entries deleted
 */
export async function clearExpired(): Promise<number> {
  try {
    // Use direct pg.Client instead of prisma.$executeRaw (PrismaPg adapter doesn't support it)
    const client = await getDbClient();
    try {
      const result = await client.query('DELETE FROM "rate_limit" WHERE reset_time <= NOW()');
      return result.rowCount ?? 0;
    } finally {
      await client.end();
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    // Check if it's a "relation does not exist" error
    if (errorObj.message.includes('relation "rate_limit" does not exist')) {
      // Tables don't exist yet, return 0
      return 0;
    }
    logError('Rate limit cleanup failed', {
      event: 'rate_limit_cleanup_failed',
    }, errorObj);
    return 0;
  }
}

/**
 * Get rate limit statistics
 * @returns Rate limit statistics
 */
export async function getStats(): Promise<{
  totalEntries: number;
  expiredEntries: number;
  activeEntries: number;
}> {
  try {
    // Use direct pg.Client instead of prisma.$queryRaw (PrismaPg adapter doesn't support it)
    const client = await getDbClient();
    try {
      const [totalResult, expiredResult] = await Promise.all([
        client.query<{count: bigint}>('SELECT COUNT(*) as count FROM "rate_limit"'),
        client.query<{count: bigint}>('SELECT COUNT(*) as count FROM "rate_limit" WHERE reset_time <= NOW()'),
      ]);

      const totalEntries = Number(totalResult.rows[0]?.count ?? 0);
      const expiredEntries = Number(expiredResult.rows[0]?.count ?? 0);
      const activeEntries = totalEntries - expiredEntries;

      return {
        totalEntries,
        expiredEntries,
        activeEntries,
      };
    } finally {
      await client.end();
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    // Check if it's a "relation does not exist" error
    if (errorObj.message.includes('relation "rate_limit" does not exist')) {
      // Tables don't exist yet, return zeros
      return {
        totalEntries: 0,
        expiredEntries: 0,
        activeEntries: 0,
      };
    }
    logError('Rate limit stats failed', {
      event: 'rate_limit_stats_failed',
    }, errorObj);
    return {
      totalEntries: 0,
      expiredEntries: 0,
      activeEntries: 0,
    };
  }
}

/**
 * Initialize rate limit tables if they don't exist
 * Creates UNLOGGED tables for high-performance rate limiting
 */
/**
 * Get a database client for database operations
 * Uses a direct Client connection instead of the pool to avoid connection issues
 * The pool may have connection string issues in Docker, so we create a fresh client
 * This is used for both DDL and DML operations since PrismaPg adapter doesn't support raw queries
 */
async function getDbClient(maxRetries = 5, delayMs = 1000): Promise<Client> {
  // config.database.url already has adjusted hostname via getter
  const connectionString = config.database.url;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = new Client({connectionString});
    try {
      await client.connect();
      return client;
    } catch (error) {
      // Clean up failed client
      try {
        await client.end();
      } catch {
        // Ignore cleanup errors
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to get database client after retries');
}

export async function initializeRateLimitTables(): Promise<void> {
  try {
    // Create rate_limit table
    // Use a direct Client connection for DDL operations
    // PrismaPg adapter doesn't support raw DDL, and pool may have connection issues
    const client = await getDbClient();
    try {
      const createTableSql = `CREATE UNLOGGED TABLE IF NOT EXISTS "rate_limit" (
          "key" TEXT NOT NULL,
          "count" INTEGER NOT NULL DEFAULT 1,
          "reset_time" TIMESTAMPTZ NOT NULL,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("key")
        )`;
      await client.query(createTableSql);

      // Create rate_limit index
      await client.query('CREATE INDEX IF NOT EXISTS "rate_limit_reset_time_idx" ON "rate_limit"("reset_time")');
    } finally {
      await client.end();
    }

    logInfo('Rate limit tables initialized', {});
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Failed to initialize rate limit tables', {
      event: 'rate_limit_tables_init_failed',
    }, errorObj);
    throw errorObj;
  }
}
