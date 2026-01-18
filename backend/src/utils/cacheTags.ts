/**
 * Cache Tags Utilities
 * Provides tag-based cache invalidation for related data
 */

import * as postgresCache from './postgresCache';

/**
 * Cache tag constants
 */
export const CACHE_TAGS = {
  // Entity tags
  ACCOUNT: (accountId: string) => `account:${accountId}`,
  CATEGORY: (categoryId: string) => `category:${categoryId}`,
  PAYEE: (payeeId: string) => `payee:${payeeId}`,
  TRANSACTION: (transactionId: string) => `transaction:${transactionId}`,
  BUDGET: (budgetId: string) => `budget:${budgetId}`,
  WORKSPACE: (workspaceId: string) => `workspace:${workspaceId}`,
  USER: (userId: string) => `user:${userId}`,

  // Collection tags
  ACCOUNTS: (workspaceId: string) => `accounts:${workspaceId}`,
  CATEGORIES: (workspaceId: string) => `categories:${workspaceId}`,
  PAYEES: (workspaceId: string) => `payees:${workspaceId}`,
  TRANSACTIONS: (workspaceId: string) => `transactions:${workspaceId}`,
  BUDGETS: (workspaceId: string) => `budgets:${workspaceId}`,

  // Query tags
  TRANSACTION_QUERIES: (workspaceId: string) => `transaction_queries:${workspaceId}`,
  REPORTS: (workspaceId: string) => `reports:${workspaceId}`,
} as const;

/**
 * Invalidate cache for an account and related data
 */
export async function invalidateAccountCache(accountId: string, workspaceId: string): Promise<void> {
  await postgresCache.invalidateByTags([
    CACHE_TAGS.ACCOUNT(accountId),
    CACHE_TAGS.ACCOUNTS(workspaceId),
    CACHE_TAGS.TRANSACTIONS(workspaceId),
    CACHE_TAGS.TRANSACTION_QUERIES(workspaceId),
    CACHE_TAGS.REPORTS(workspaceId),
  ]);
}

/**
 * Invalidate cache for a category and related data
 */
export async function invalidateCategoryCache(categoryId: string, workspaceId: string): Promise<void> {
  await postgresCache.invalidateByTags([
    CACHE_TAGS.CATEGORY(categoryId),
    CACHE_TAGS.CATEGORIES(workspaceId),
    CACHE_TAGS.TRANSACTIONS(workspaceId),
    CACHE_TAGS.TRANSACTION_QUERIES(workspaceId),
    CACHE_TAGS.REPORTS(workspaceId),
    CACHE_TAGS.BUDGETS(workspaceId),
  ]);
}

/**
 * Invalidate cache for a payee and related data
 */
export async function invalidatePayeeCache(payeeId: string, workspaceId: string): Promise<void> {
  await postgresCache.invalidateByTags([
    CACHE_TAGS.PAYEE(payeeId),
    CACHE_TAGS.PAYEES(workspaceId),
    CACHE_TAGS.TRANSACTIONS(workspaceId),
    CACHE_TAGS.TRANSACTION_QUERIES(workspaceId),
    CACHE_TAGS.REPORTS(workspaceId),
    CACHE_TAGS.BUDGETS(workspaceId),
  ]);
}

/**
 * Invalidate cache for a transaction and related data
 */
export async function invalidateTransactionCache(transactionId: string, workspaceId: string): Promise<void> {
  await postgresCache.invalidateByTags([
    CACHE_TAGS.TRANSACTION(transactionId),
    CACHE_TAGS.TRANSACTIONS(workspaceId),
    CACHE_TAGS.TRANSACTION_QUERIES(workspaceId),
    CACHE_TAGS.REPORTS(workspaceId),
  ]);
}

/**
 * Invalidate cache for a budget and related data
 */
export async function invalidateBudgetCache(budgetId: string, workspaceId: string): Promise<void> {
  await postgresCache.invalidateByTags([
    CACHE_TAGS.BUDGET(budgetId),
    CACHE_TAGS.BUDGETS(workspaceId),
    CACHE_TAGS.REPORTS(workspaceId),
  ]);
}
