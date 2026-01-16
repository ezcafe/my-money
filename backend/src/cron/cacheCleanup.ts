/**
 * Cache Cleanup Cron Job
 * Periodically removes expired cache and rate limit entries
 * Prevents table bloat and maintains performance
 */

import cron from 'node-cron';
import {clearExpired as clearCacheExpired, getStats as getCacheStats} from '../utils/postgresCache';
import {clearExpired as clearRateLimitExpired, getStats as getRateLimitStats} from '../utils/postgresRateLimiter';
import {logInfo, logError, logWarn} from '../utils/logger';

/**
 * Cleanup expired cache and rate limit entries
 * @returns Cleanup statistics
 */
export async function cleanupExpiredEntries(): Promise<{
  cacheDeleted: number;
  rateLimitDeleted: number;
  cacheStats: {
    totalEntries: number;
    expiredEntries: number;
    activeEntries: number;
  };
  rateLimitStats: {
    totalEntries: number;
    expiredEntries: number;
    activeEntries: number;
  };
}> {
  logInfo('Starting cache cleanup', {});

  try {
    // Cleanup expired entries in parallel
    const [cacheDeleted, rateLimitDeleted, cacheStats, rateLimitStats] = await Promise.all([
      clearCacheExpired(),
      clearRateLimitExpired(),
      getCacheStats(),
      getRateLimitStats(),
    ]);

    const stats = {
      cacheDeleted,
      rateLimitDeleted,
      cacheStats,
      rateLimitStats,
    };

    logInfo('Completed cache cleanup', {
      cacheDeleted: stats.cacheDeleted,
      rateLimitDeleted: stats.rateLimitDeleted,
      cacheTotal: stats.cacheStats.totalEntries,
      cacheActive: stats.cacheStats.activeEntries,
      rateLimitTotal: stats.rateLimitStats.totalEntries,
      rateLimitActive: stats.rateLimitStats.activeEntries,
    });

    // Warn if there are many expired entries that weren't cleaned up
    if (stats.cacheStats.expiredEntries > 1000) {
      logWarn('Many expired cache entries remain', {
        expiredEntries: stats.cacheStats.expiredEntries,
        deleted: stats.cacheDeleted,
      });
    }

    if (stats.rateLimitStats.expiredEntries > 1000) {
      logWarn('Many expired rate limit entries remain', {
        expiredEntries: stats.rateLimitStats.expiredEntries,
        deleted: stats.rateLimitDeleted,
      });
    }

    return stats;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Cache cleanup failed', {}, errorObj);
    throw error;
  }
}

/**
 * Start cron job to run cache cleanup every 5 minutes
 * Prevents table bloat by regularly removing expired entries
 */
export function startCacheCleanupCron(): void {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async (): Promise<void> => {
    try {
      logInfo('Cron job started: Cache cleanup');
      const stats = await cleanupExpiredEntries();
      logInfo('Cron job completed: Cache cleanup finished', {
        cacheDeleted: stats.cacheDeleted,
        rateLimitDeleted: stats.rateLimitDeleted,
      });
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError('Cron job failed with unexpected error', {
        jobName: 'cacheCleanup',
      }, errorObj);
    }
  });

  logInfo('Cache cleanup cron job scheduled', {
    schedule: '*/5 * * * *',
    description: 'Every 5 minutes',
  });
}
