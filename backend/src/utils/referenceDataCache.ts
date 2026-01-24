/**
 * Reference Data Cache Utilities
 * Provides caching for frequently accessed reference data (Categories, Payees, Accounts)
 * Uses longer TTL since reference data changes less frequently
 */

import * as postgresCache from './postgresCache';
import { categoryKey, payeeKey, accountKey } from './cacheKeys';

/**
 * Reference data cache TTL (15 minutes)
 */
const REFERENCE_DATA_CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Get category from cache or database
 * @param categoryId - Category ID
 * @param factory - Function to fetch from database if not cached
 * @returns Category data
 */
export async function getCategory<T>(
  categoryId: string,
  factory: () => Promise<T>
): Promise<T> {
  const key = categoryKey(categoryId);
  return await postgresCache.getOrSet(
    key,
    factory,
    REFERENCE_DATA_CACHE_TTL_MS
  );
}

/**
 * Get payee from cache or database
 * @param payeeId - Payee ID
 * @param factory - Function to fetch from database if not cached
 * @returns Payee data
 */
export async function getPayee<T>(
  payeeId: string,
  factory: () => Promise<T>
): Promise<T> {
  const key = payeeKey(payeeId);
  return await postgresCache.getOrSet(
    key,
    factory,
    REFERENCE_DATA_CACHE_TTL_MS
  );
}

/**
 * Get account from cache or database
 * @param accountId - Account ID
 * @param factory - Function to fetch from database if not cached
 * @returns Account data
 */
export async function getAccount<T>(
  accountId: string,
  factory: () => Promise<T>
): Promise<T> {
  const key = accountKey(accountId);
  return await postgresCache.getOrSet(
    key,
    factory,
    REFERENCE_DATA_CACHE_TTL_MS
  );
}

/**
 * Invalidate category cache
 * @param categoryId - Category ID
 */
export async function invalidateCategory(categoryId: string): Promise<void> {
  const key = categoryKey(categoryId);
  await postgresCache.deleteKey(key);
}

/**
 * Invalidate payee cache
 * @param payeeId - Payee ID
 */
export async function invalidatePayee(payeeId: string): Promise<void> {
  const key = payeeKey(payeeId);
  await postgresCache.deleteKey(key);
}

/**
 * Invalidate account cache
 * @param accountId - Account ID
 */
export async function invalidateAccount(accountId: string): Promise<void> {
  const key = accountKey(accountId);
  await postgresCache.deleteKey(key);
}

/**
 * Invalidate all reference data caches for a user
 * @param userId - User ID
 */
export async function invalidateUserReferenceData(
  userId: string
): Promise<void> {
  // Invalidate all user-related reference data
  await Promise.all([
    postgresCache.deletePattern(`category:${userId}:%`),
    postgresCache.deletePattern(`payee:${userId}:%`),
    postgresCache.deletePattern(`account:${userId}:%`),
  ]);
}
