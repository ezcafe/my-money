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

import {prisma} from './prisma';
import {logError, logInfo} from './logger';

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

    // Atomic increment using PostgreSQL
    // If record doesn't exist, create it with count=1
    // If record exists and window expired, reset it
    // If record exists and window active, increment count
    const result = await prisma.$queryRaw<Array<{
      count: number;
      reset_time: Date;
    }>>`
      INSERT INTO "rate_limit" (key, count, reset_time, created_at)
      VALUES (${key}, 1, ${resetTime}, NOW())
      ON CONFLICT (key) DO UPDATE
        SET count = CASE
          WHEN "rate_limit".reset_time <= NOW() THEN 1
          ELSE "rate_limit".count + 1
        END,
        reset_time = CASE
          WHEN "rate_limit".reset_time <= NOW() THEN ${resetTime}
          ELSE "rate_limit".reset_time
        END
      RETURNING count, reset_time
    `;

    if (result.length === 0 || !result[0]) {
      // Should not happen, but handle gracefully
      return {
        allowed: true,
        remaining: max - 1,
        resetAt: now + windowMs,
      };
    }

    const row = result[0];
    const count = row.count;
    const resetAt = row.reset_time.getTime();

    const allowed = count <= max;
    const remaining = Math.max(0, max - count);

    return {
      allowed,
      remaining,
      resetAt,
    };
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
    const result = await prisma.$executeRaw`
      DELETE FROM "rate_limit" WHERE reset_time <= NOW()
    `;

    // $executeRaw returns number of affected rows
    return typeof result === 'number' ? result : 0;
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
    const [totalResult, expiredResult] = await Promise.all([
      prisma.$queryRaw<Array<{count: bigint}>>`
        SELECT COUNT(*) as count FROM "rate_limit"
      `,
      prisma.$queryRaw<Array<{count: bigint}>>`
        SELECT COUNT(*) as count FROM "rate_limit" WHERE reset_time <= NOW()
      `,
    ]);

    const totalEntries = Number(totalResult[0]?.count ?? 0);
    const expiredEntries = Number(expiredResult[0]?.count ?? 0);
    const activeEntries = totalEntries - expiredEntries;

    return {
      totalEntries,
      expiredEntries,
      activeEntries,
    };
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
export async function initializeRateLimitTables(): Promise<void> {
  try {
    // Create rate_limit table
    await prisma.$executeRaw`
      CREATE UNLOGGED TABLE IF NOT EXISTS "rate_limit" (
        "key" TEXT NOT NULL,
        "count" INTEGER NOT NULL DEFAULT 1,
        "reset_time" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("key")
      )
    `;

    // Create rate_limit index
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "rate_limit_reset_time_idx" ON "rate_limit"("reset_time")
    `;

    logInfo('Rate limit tables initialized', {});
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Failed to initialize rate limit tables', {
      event: 'rate_limit_tables_init_failed',
    }, errorObj);
    throw errorObj;
  }
}
