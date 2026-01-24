/**
 * Optimistic Mutation Hook
 * Provides a hook for mutations with optimistic updates
 */

import { useMutation } from '@apollo/client/react';
import type {
  DocumentNode,
  InMemoryCache,
  OperationVariables,
  FetchResult,
  ApolloCache,
} from '@apollo/client';
import type { MutationHookOptions, MutationTuple } from '@apollo/client/react';

/**
 * Options for optimistic mutation
 */
interface OptimisticMutationOptions<
  TData,
  TVariables extends OperationVariables = OperationVariables,
> {
  /**
   * Function to create optimistic response from variables
   */
  optimisticResponse: (variables: TVariables) => TData;
  /**
   * Function to update cache after mutation
   */
  updateCache?: (cache: InMemoryCache, data: TData) => void;
  /**
   * Cache invalidation pattern to use
   */
  invalidateCache?: (cache: InMemoryCache) => void;
  /**
   * Additional mutation options
   */
  mutationOptions?: Omit<MutationHookOptions<TData, TVariables>, 'optimisticResponse' | 'update'>;
}

/**
 * Hook for mutations with optimistic updates
 * @param mutation - GraphQL mutation document
 * @param options - Optimistic mutation options
 * @returns Mutation tuple [mutate function, mutation result]
 */
export function useOptimisticMutation<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  mutation: DocumentNode,
  options: OptimisticMutationOptions<TData, TVariables>
): MutationTuple<TData, TVariables> {
  const { optimisticResponse, updateCache, invalidateCache, mutationOptions } = options;

  return useMutation<TData, TVariables>(mutation, {
    ...mutationOptions,
    optimisticResponse: (variables: TVariables) => optimisticResponse(variables),
    update: (cache: ApolloCache, result: FetchResult<TData>) => {
      if (result.data) {
        // Update cache with server response
        if (updateCache) {
          updateCache(cache as unknown as InMemoryCache, result.data);
        }

        // Invalidate related cache entries
        if (invalidateCache) {
          invalidateCache(cache as unknown as InMemoryCache);
        }
      }
    },
  });
}
