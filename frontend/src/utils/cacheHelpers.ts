/**
 * Cache Helper Utilities
 * Provides utilities for cache invalidation and management
 */

import type { InMemoryCache } from '@apollo/client';

/**
 * Invalidate cache entries for a specific field
 * @param cache - Apollo cache instance
 * @param fieldName - Field name to invalidate
 * @param args - Optional arguments to match specific cache entries
 */
export function invalidateCacheField(
  cache: InMemoryCache,
  fieldName: string,
  args?: Record<string, unknown>
): void {
  cache.evict({ fieldName, args });
  cache.gc(); // Garbage collect evicted entries
}

/**
 * Invalidate multiple cache fields
 * @param cache - Apollo cache instance
 * @param fieldNames - Array of field names to invalidate
 */
export function invalidateCacheFields(cache: InMemoryCache, fieldNames: string[]): void {
  for (const fieldName of fieldNames) {
    cache.evict({ fieldName });
  }
  cache.gc();
}

/**
 * Invalidate cache for a specific type
 * @param cache - Apollo cache instance
 * @param typeName - Type name to invalidate
 * @param id - Optional ID to invalidate specific object
 */
export function invalidateCacheType(cache: InMemoryCache, typeName: string, id?: string): void {
  if (id) {
    const cacheId = cache.identify({ __typename: typeName, id });
    if (cacheId) {
      cache.evict({ id: cacheId });
    }
  } else {
    // Evict all objects of this type
    cache.modify({
      fields: {
        [typeName]: (_existing, { DELETE }) => DELETE,
      },
    });
  }
  cache.gc();
}

/**
 * Common cache invalidation patterns for mutations
 */
export const cacheInvalidationPatterns = {
  /**
   * Invalidate transactions-related cache after transaction mutations
   */
  afterTransactionMutation: (cache: InMemoryCache): void => {
    invalidateCacheFields(cache, ['transactions', 'recentTransactions', 'reportTransactions']);
  },

  /**
   * Invalidate account-related cache after account mutations
   */
  afterAccountMutation: (cache: InMemoryCache): void => {
    invalidateCacheFields(cache, ['accounts', 'account', 'accountBalance']);
  },

  /**
   * Invalidate category-related cache after category mutations
   */
  afterCategoryMutation: (cache: InMemoryCache): void => {
    invalidateCacheFields(cache, ['categories', 'category']);
  },

  /**
   * Invalidate payee-related cache after payee mutations
   */
  afterPayeeMutation: (cache: InMemoryCache): void => {
    invalidateCacheFields(cache, ['payees', 'payee']);
  },
};
