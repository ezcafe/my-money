/**
 * Cache Key Generation Utilities
 * Centralized cache key generation to ensure consistency
 */

/**
 * Generate cache key for account balance
 * @param accountId - Account ID
 * @returns Cache key
 */
export function accountBalanceKey(accountId: string): string {
  return `account:balance:${accountId}`;
}

/**
 * Generate cache key for OIDC token validation
 * @param tokenHash - Hashed token
 * @returns Cache key
 */
export function tokenKey(tokenHash: string): string {
  return `token:hash:${tokenHash}`;
}

/**
 * Generate cache key for report aggregations
 * @param userId - User ID
 * @param filterHash - Hash of filter parameters
 * @returns Cache key
 */
export function reportKey(userId: string, filterHash: string): string {
  return `report:${userId}:${filterHash}`;
}

/**
 * Generate cache key for transaction queries
 * @param userId - User ID
 * @param filterHash - Hash of filter parameters
 * @returns Cache key
 */
export function transactionQueryKey(userId: string, filterHash: string): string {
  return `transaction:query:${userId}:${filterHash}`;
}

/**
 * Generate cache key for user lookup
 * @param oidcSubject - OIDC subject
 * @returns Cache key
 */
export function userKey(oidcSubject: string): string {
  return `user:oidc:${oidcSubject}`;
}

/**
 * Generate cache key for category
 * @param categoryId - Category ID
 * @returns Cache key
 */
export function categoryKey(categoryId: string): string {
  return `category:${categoryId}`;
}

/**
 * Generate cache key for payee
 * @param payeeId - Payee ID
 * @returns Cache key
 */
export function payeeKey(payeeId: string): string {
  return `payee:${payeeId}`;
}

/**
 * Generate cache key for account reference data
 * @param accountId - Account ID
 * @returns Cache key
 */
export function accountKey(accountId: string): string {
  return `account:${accountId}`;
}

/**
 * Generate hash from filter parameters for cache key
 * @param filters - Filter object
 * @returns Hash string
 */
export function hashFilters(filters: Record<string, unknown>): string {
  // Sort keys for consistent hashing
  const sorted = Object.keys(filters)
    .sort()
    .map((key) => `${key}:${JSON.stringify(filters[key])}`)
    .join('|');

  // Simple hash function (for better performance, could use crypto.createHash)
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}
