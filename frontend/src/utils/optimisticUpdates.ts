/**
 * Optimistic Updates Utility
 * Provides helpers for implementing optimistic updates in Apollo mutations
 */

import type {FetchResult} from '@apollo/client';

/**
 * Create an optimistic response for a mutation
 * This allows the UI to update immediately before the server responds
 * @param mutationName - Name of the mutation
 * @param data - Optimistic data to return
 * @returns Optimistic response object
 */
export function createOptimisticResponse<TData = unknown>(
  mutationName: string,
  data: TData,
): FetchResult<TData> {
  return {
    data: {
      [mutationName]: data,
    } as FetchResult<TData>['data'],
  } as FetchResult<TData>;
}

/**
 * Update cache optimistically for a mutation
 * This function can be used in the update function of useMutation
 * @param cache - Apollo cache instance
 * @param query - GraphQL query to update
 * @param variables - Query variables
 * @param updateFn - Function to update the cached data
 */
export function updateCacheOptimistically<TData = unknown>(
  cache: {readQuery: (options: {query: unknown; variables?: unknown}) => TData | null; writeQuery: (options: {query: unknown; data: TData; variables?: unknown}) => void},
  query: unknown,
  variables: unknown,
  updateFn: (existing: TData | null) => TData,
): void {
  try {
    const existing = cache.readQuery({query, variables});
    const updated = updateFn(existing);
    cache.writeQuery({query, data: updated, variables});
  } catch (error) {
    // Silently handle cache update errors - mutation will still proceed
    console.warn('Optimistic cache update failed:', error);
  }
}

/**
 * Example usage:
 *
 * const [createTransaction] = useMutation(CREATE_TRANSACTION, {
 *   optimisticResponse: createOptimisticResponse('createTransaction', {
 *     id: 'temp-id',
 *     value: input.value,
 *     date: input.date,
 *     // ... other fields
 *   }),
 *   update: (cache, {data}) => {
 *     if (data?.createTransaction) {
 *       updateCacheOptimistically(
 *         cache,
 *         GET_RECENT_TRANSACTIONS,
 *         {},
 *         (existing) => ({
 *           recentTransactions: [
 *             data.createTransaction,
 *             ...(existing?.recentTransactions ?? []),
 *           ],
 *         }),
 *       );
 *     }
 *   },
 * });
 */

