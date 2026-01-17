/**
 * Field-Level Caching Utilities
 * Provides caching for expensive computed fields
 * Now uses PostgreSQL cache for distributed caching
 */

import * as postgresCache from './postgresCache';
import {accountBalanceKey} from './cacheKeys';

/**
 * Account balance cache TTL (1 minute)
 */
const BALANCE_CACHE_TTL_MS = 60 * 1000;

/**
 * Get account balance from cache
 * @param accountId - Account ID
 * @returns Cached balance or null if not found/expired
 */
export async function getAccountBalance(accountId: string): Promise<number | null> {
  const key = accountBalanceKey(accountId);
  return await postgresCache.get<number>(key);
}

/**
 * Set account balance in cache
 * @param accountId - Account ID
 * @param balance - Balance value
 */
export async function setAccountBalance(accountId: string, balance: number): Promise<void> {
  const key = accountBalanceKey(accountId);
  await postgresCache.set(key, balance, BALANCE_CACHE_TTL_MS);
}

/**
 * Invalidate account balance cache
 * @param accountId - Account ID
 */
export async function invalidateAccountBalance(accountId: string): Promise<void> {
  const key = accountBalanceKey(accountId);
  await postgresCache.deleteKey(key);
}

