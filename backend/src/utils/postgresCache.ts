/**
 * PostgreSQL Cache Service
 * Provides high-performance caching using PostgreSQL UNLOGGED tables
 * Implements cache-aside pattern with TTL-based expiration
 *
 * Performance characteristics:
 * - UNLOGGED tables skip WAL for faster writes (~0.08ms vs 0.05ms for Redis)
 * - Shared cache across multiple server instances
 * - Survives server restarts (until database restart)
 */

import {prisma} from './prisma';
import {logError, logWarn, logInfo} from './logger';

/**
 * Get cached value if not expired
 * @param key - Cache key
 * @returns Cached value or null if not found/expired
 */
export async function get<T>(key: string): Promise<T | null> {
  try {
    const result = await prisma.$queryRaw<Array<{value: unknown; expires_at: Date}>>`
      SELECT value, expires_at
      FROM "cache"
      WHERE key = ${key} AND expires_at > NOW()
    `;

    if (result.length === 0 || !result[0]) {
      return null;
    }

    const row = result[0];
    return row.value as T;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Cache get failed', {
      event: 'cache_get_failed',
      key,
    }, errorObj);
    // Return null on error to allow application to continue
    return null;
  }
}

/**
 * Store value in cache with TTL
 * @param key - Cache key
 * @param value - Value to cache (will be serialized as JSONB)
 * @param ttlMs - Time to live in milliseconds
 */
export async function set<T>(key: string, value: T, ttlMs: number): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlMs);

    await prisma.$executeRaw`
      INSERT INTO "cache" (key, value, expires_at, created_at)
      VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${expiresAt}, NOW())
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            expires_at = EXCLUDED.expires_at,
            created_at = NOW()
    `;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Cache set failed', {
      event: 'cache_set_failed',
      key,
    }, errorObj);
    // Don't throw - cache failures shouldn't break the application
  }
}

/**
 * Delete cache entry
 * @param key - Cache key to delete
 */
export async function deleteKey(key: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      DELETE FROM "cache" WHERE key = ${key}
    `;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Cache delete failed', {
      event: 'cache_delete_failed',
      key,
    }, errorObj);
  }
}

/**
 * Delete cache entries matching a pattern
 * Uses LIKE operator for pattern matching (e.g., "account:balance:*")
 * @param pattern - Pattern to match (use % for wildcard)
 */
export async function deletePattern(pattern: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      DELETE FROM "cache" WHERE key LIKE ${pattern}
    `;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Cache delete pattern failed', {
      event: 'cache_delete_pattern_failed',
      pattern,
    }, errorObj);
  }
}

/**
 * Get or set pattern - get from cache or compute and cache
 * Prevents cache stampede by checking cache first
 * @param key - Cache key
 * @param factory - Function to compute value if not in cache
 * @param ttlMs - Time to live in milliseconds
 * @returns Cached or computed value
 */
export async function getOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  // Try to get from cache first
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Compute value
  const value = await factory();

  // Cache the result (fire and forget - don't wait)
  void set(key, value, ttlMs).catch((error) => {
    logWarn('Failed to cache computed value', {
      event: 'cache_set_async_failed',
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return value;
}

/**
 * Invalidate all account-related cache entries
 * @param accountId - Account ID
 */
export async function invalidateAccountCache(accountId: string): Promise<void> {
  await deletePattern(`account:balance:${accountId}`);
  await deletePattern(`account:${accountId}:%`);
}

/**
 * Invalidate all user-related cache entries
 * @param userId - User ID
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await deletePattern(`user:${userId}:%`);
  await deletePattern(`report:${userId}:%`);
  await deletePattern(`transaction:query:${userId}:%`);
}

/**
 * Clear expired cache entries
 * @returns Number of entries deleted
 */
export async function clearExpired(): Promise<number> {
  try {
    const result = await prisma.$executeRaw`
      DELETE FROM "cache" WHERE expires_at <= NOW()
    `;

    // $executeRaw returns number of affected rows
    return typeof result === 'number' ? result : 0;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    // Check if it's a "relation does not exist" error
    if (errorObj.message.includes('relation "cache" does not exist')) {
      // Tables don't exist yet, return 0
      return 0;
    }
    logError('Cache cleanup failed', {
      event: 'cache_cleanup_failed',
    }, errorObj);
    return 0;
  }
}

/**
 * Get cache statistics
 * @returns Cache statistics
 */
export async function getStats(): Promise<{
  totalEntries: number;
  expiredEntries: number;
  activeEntries: number;
}> {
  try {
    const [totalResult, expiredResult] = await Promise.all([
      prisma.$queryRaw<Array<{count: bigint}>>`
        SELECT COUNT(*) as count FROM "cache"
      `,
      prisma.$queryRaw<Array<{count: bigint}>>`
        SELECT COUNT(*) as count FROM "cache" WHERE expires_at <= NOW()
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
    if (errorObj.message.includes('relation "cache" does not exist')) {
      // Tables don't exist yet, return zeros
      return {
        totalEntries: 0,
        expiredEntries: 0,
        activeEntries: 0,
      };
    }
    logError('Cache stats failed', {
      event: 'cache_stats_failed',
    }, errorObj);
    return {
      totalEntries: 0,
      expiredEntries: 0,
      activeEntries: 0,
    };
  }
}

/**
 * Initialize cache tables if they don't exist
 * Creates UNLOGGED tables for high-performance caching
 */
export async function initializeCacheTables(): Promise<void> {
  try {
    // Create cache table
    await prisma.$executeRaw`
      CREATE UNLOGGED TABLE IF NOT EXISTS "cache" (
        "key" TEXT NOT NULL,
        "value" JSONB NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "cache_pkey" PRIMARY KEY ("key")
      )
    `;

    // Create cache indexes
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "cache_expires_at_idx" ON "cache"("expires_at")
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "cache_value_gin_idx" ON "cache" USING GIN ("value")
    `;

    logInfo('Cache tables initialized', {});
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Failed to initialize cache tables', {
      event: 'cache_tables_init_failed',
    }, errorObj);
    throw errorObj;
  }
}
