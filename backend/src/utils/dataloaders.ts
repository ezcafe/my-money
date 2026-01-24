/**
 * DataLoader utilities for batching and caching database queries
 * Prevents N+1 query problems
 */

import DataLoader from 'dataloader';
import { prisma } from './prisma';
import type { Account, Category, Payee, User } from '@prisma/client';

/**
 * Create a cache map with size limit to prevent unbounded memory growth
 * Uses LRU-like eviction when cache exceeds max size
 * Implements DataLoader's CacheMap interface
 */
class LimitedCacheMap<K, V> implements Map<K, V> {
  private readonly maxSize: number;
  private readonly map: Map<K, V>;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.map = new Map<K, V>();
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  forEach(
    callbackfn: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: unknown
  ): void {
    this.map.forEach(callbackfn, thisArg);
  }

  get(key: K): V | undefined {
    return this.map.get(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): this {
    // If cache is full, remove oldest entry (first in map)
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        this.map.delete(firstKey);
      }
    }
    this.map.set(key, value);
    return this;
  }

  entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.map[Symbol.iterator]();
  }

  get [Symbol.toStringTag](): string {
    return 'LimitedCacheMap';
  }
}

// Cache size limits to prevent unbounded memory growth
const CACHE_SIZE_LIMIT = 1000; // Maximum number of items to cache per DataLoader

/**
 * Create a DataLoader for account balance lookups
 * Batches multiple account balance queries by reading from stored balance column
 * O(1) read performance - no aggregation needed
 */
export function createAccountBalanceLoader(): DataLoader<string, number> {
  return new DataLoader<string, number>(
    async (accountIds: readonly string[]): Promise<number[]> => {
      // Fetch accounts with balance column
      const accounts = await prisma.account.findMany({
        where: { id: { in: [...accountIds] } },
        select: { id: true, balance: true },
      });

      // Create map for efficient lookup
      const accountMap = new Map<string, number>(
        accounts.map((account) => [account.id, Number(account.balance)])
      );

      // Return balance for each account ID, defaulting to 0 if not found
      return accountIds.map((id) => accountMap.get(id) ?? 0);
    },
    {
      // Type assertion needed: DataLoader's CacheMap interface expects get() to return Promise<V> | void,
      // but our LimitedCacheMap returns V | undefined. DataLoader internally handles Promises,
      // so this type mismatch is acceptable. The cache still works correctly.
      // Using a more specific type assertion instead of 'any'
      cacheMap: new LimitedCacheMap<string, number>(
        CACHE_SIZE_LIMIT
      ) as unknown as DataLoader.Options<string, number>['cacheMap'],
    }
  );
}

/**
 * Create a DataLoader for category lookups
 */
export function createCategoryLoader(): DataLoader<string, Category | null> {
  return new DataLoader<string, Category | null>(
    async (categoryIds: readonly string[]): Promise<Array<Category | null>> => {
      const categories = await prisma.category.findMany({
        where: { id: { in: [...categoryIds] } },
      });

      const categoryMap = new Map<string, Category>(
        categories.map((cat) => [cat.id, cat])
      );
      return categoryIds.map((id) => categoryMap.get(id) ?? null);
    },
    {
      // Type assertion needed: See comment in createAccountBalanceLoader for explanation
      cacheMap: new LimitedCacheMap<string, Category | null>(
        CACHE_SIZE_LIMIT
      ) as unknown as DataLoader.Options<string, Category | null>['cacheMap'],
    }
  );
}

/**
 * Create a DataLoader for payee lookups
 */
export function createPayeeLoader(): DataLoader<string, Payee | null> {
  return new DataLoader<string, Payee | null>(
    async (payeeIds: readonly string[]): Promise<Array<Payee | null>> => {
      const payees = await prisma.payee.findMany({
        where: { id: { in: [...payeeIds] } },
      });

      const payeeMap = new Map<string, Payee>(
        payees.map((payee) => [payee.id, payee])
      );
      return payeeIds.map((id) => payeeMap.get(id) ?? null);
    },
    {
      // Type assertion needed: See comment in createAccountBalanceLoader for explanation
      cacheMap: new LimitedCacheMap<string, Payee | null>(
        CACHE_SIZE_LIMIT
      ) as unknown as DataLoader.Options<string, Payee | null>['cacheMap'],
    }
  );
}

/**
 * Create a DataLoader for account lookups
 */
export function createAccountLoader(): DataLoader<string, Account | null> {
  return new DataLoader<string, Account | null>(
    async (accountIds: readonly string[]): Promise<Array<Account | null>> => {
      const accounts = await prisma.account.findMany({
        where: { id: { in: [...accountIds] } },
      });

      const accountMap = new Map<string, Account>(
        accounts.map((acc) => [acc.id, acc])
      );
      return accountIds.map((id) => accountMap.get(id) ?? null);
    },
    {
      // Type assertion needed: See comment in createAccountBalanceLoader for explanation
      cacheMap: new LimitedCacheMap<string, Account | null>(
        CACHE_SIZE_LIMIT
      ) as unknown as DataLoader.Options<string, Account | null>['cacheMap'],
    }
  );
}

/**
 * Create a DataLoader for user lookups
 */
export function createUserLoader(): DataLoader<string, User | null> {
  return new DataLoader<string, User | null>(
    async (userIds: readonly string[]): Promise<Array<User | null>> => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
      });

      const userMap = new Map<string, User>(
        users.map((user) => [user.id, user])
      );
      return userIds.map((id) => userMap.get(id) ?? null);
    },
    {
      // Type assertion needed: See comment in createAccountBalanceLoader for explanation
      cacheMap: new LimitedCacheMap<string, User | null>(
        CACHE_SIZE_LIMIT
      ) as unknown as DataLoader.Options<string, User | null>['cacheMap'],
    }
  );
}

/**
 * DataLoader context interface
 */
export interface DataLoaderContext {
  accountBalanceLoader: ReturnType<typeof createAccountBalanceLoader>;
  categoryLoader: ReturnType<typeof createCategoryLoader>;
  payeeLoader: ReturnType<typeof createPayeeLoader>;
  accountLoader: ReturnType<typeof createAccountLoader>;
  userLoader: ReturnType<typeof createUserLoader>;
}

/**
 * Create all DataLoaders for a request context
 */
export function createDataLoaders(): DataLoaderContext {
  return {
    accountBalanceLoader: createAccountBalanceLoader(),
    categoryLoader: createCategoryLoader(),
    payeeLoader: createPayeeLoader(),
    accountLoader: createAccountLoader(),
    userLoader: createUserLoader(),
  };
}
