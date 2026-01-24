/**
 * Field-Level Caching Utilities
 * Provides caching for expensive computed fields
 * Now uses PostgreSQL cache for distributed caching
 */

import * as postgresCache from './postgresCache';
import { accountBalanceKey } from './cacheKeys';
import { CACHE_TAGS } from './cacheTags';

/**
 * Account balance cache TTL (1 minute)
 */
const BALANCE_CACHE_TTL_MS = 60 * 1000;

/**
 * Get account balance from cache
 * @param accountId - Account ID
 * @returns Cached balance or null if not found/expired
 */
export async function getAccountBalance(
  accountId: string
): Promise<number | null> {
  const key = accountBalanceKey(accountId);
  return await postgresCache.get<number>(key);
}

/**
 * Set account balance in cache
 * @param accountId - Account ID
 * @param balance - Balance value
 * @param workspaceId - Optional workspace ID for tag-based invalidation
 */
export async function setAccountBalance(
  accountId: string,
  balance: number,
  workspaceId?: string
): Promise<void> {
  const key = accountBalanceKey(accountId);
  const tags = workspaceId
    ? [CACHE_TAGS.ACCOUNT(accountId), CACHE_TAGS.ACCOUNTS(workspaceId)]
    : [CACHE_TAGS.ACCOUNT(accountId)];
  await postgresCache.set(key, balance, BALANCE_CACHE_TTL_MS, tags);
}

/**
 * Invalidate account balance cache
 * Uses tag-based invalidation for better cache management
 * @param accountId - Account ID
 * @param workspaceId - Optional workspace ID for tag-based invalidation
 */
export async function invalidateAccountBalance(
  accountId: string,
  workspaceId?: string
): Promise<void> {
  const key = accountBalanceKey(accountId);
  await postgresCache.deleteKey(key);
  // Also invalidate by tags for related caches
  if (workspaceId) {
    await postgresCache
      .invalidateByTags([
        CACHE_TAGS.ACCOUNT(accountId),
        CACHE_TAGS.ACCOUNTS(workspaceId),
      ])
      .catch(() => {
        // Ignore errors
      });
  }
}
