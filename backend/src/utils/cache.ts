/**
 * Field-Level Caching Utilities
 * Provides caching for expensive computed fields
 */

import {LRUCache} from 'lru-cache';

/**
 * Cache configuration options
 */
interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
}

/**
 * Create a cache instance with TTL and size limits
 * @param config - Cache configuration
 * @returns Cache instance
 */
export function createCache<TKey extends string | number, TValue extends Record<string, unknown> | string | number | boolean>(
  config: CacheConfig,
): LRUCache<TKey, TValue> {
  return new LRUCache<TKey, TValue>({
    max: config.maxSize,
    ttl: config.ttl,
    updateAgeOnGet: false, // Don't reset TTL on access
    updateAgeOnHas: false,
  });
}

/**
 * Account balance cache
 * Caches account balances for 1 minute to reduce database queries
 */
export const balanceCache = createCache<string, number>({
  ttl: 60 * 1000, // 1 minute
  maxSize: 1000,
});
