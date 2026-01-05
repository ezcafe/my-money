/**
 * Optimistic Mutation Hook
 * Provides optimistic updates for mutations with automatic rollback on error
 */

import {useMutation, type MutationHookOptions, type MutationTuple} from '@apollo/client/react';
import type {OperationVariables} from '@apollo/client';
import {useCallback} from 'react';
import {createOptimisticResponse} from '../utils/optimisticUpdates';
import type {DocumentNode} from 'graphql';

/**
 * Options for optimistic mutation
 */
interface OptimisticMutationOptions<TData, TVariables extends OperationVariables> extends Omit<MutationHookOptions<TData, TVariables>, 'optimisticResponse' | 'update'> {
  /** Mutation name (e.g., 'createTransaction') */
  mutationName: string;
  /** Function to generate optimistic data from variables */
  getOptimisticData: (variables: TVariables) => TData;
  /** Optional function to update cache optimistically */
  updateCache?: (cache: Parameters<NonNullable<MutationHookOptions<TData, TVariables>['update']>>[0], data: TData, variables: TVariables) => void;
  /** GraphQL query to update in cache (if updateCache is provided) */
  updateQuery?: DocumentNode;
  /** Variables for the query to update */
  updateQueryVariables?: unknown;
}

/**
 * Hook for mutations with optimistic updates
 * @param mutation - GraphQL mutation
 * @param options - Optimistic mutation options
 * @returns Mutation tuple with optimistic updates
 */
export function useOptimisticMutation<TData = unknown, TVariables extends OperationVariables = OperationVariables>(
  mutation: DocumentNode,
  options: OptimisticMutationOptions<TData, TVariables>,
): MutationTuple<TData, TVariables> {
  const {mutationName, getOptimisticData, updateCache, updateQueryVariables, ...mutationOptions} = options;

  const [mutate, result] = useMutation<TData, TVariables>(mutation, {
    ...mutationOptions,
    optimisticResponse: (variables: TVariables) => {
      const optimisticData = getOptimisticData(variables);
      return createOptimisticResponse(mutationName, optimisticData) as TData;
    },
    update: (cache, result) => {
      const {data} = result;
      // Call original update if provided (check if it exists in mutationOptions)
      const originalUpdate = (mutationOptions as {update?: (cache: Parameters<NonNullable<MutationHookOptions<TData, TVariables>['update']>>[0], result: {data?: TData}) => void}).update;
      if (originalUpdate && data) {
        originalUpdate(cache, {data} as {data?: TData});
      }

      // Update cache optimistically if updateCache is provided
      if (updateCache && data && updateQueryVariables) {
        updateCache(cache, data, updateQueryVariables as TVariables);
      }
    },
  });

  const optimisticMutate = useCallback(
    (...args: Parameters<typeof mutate>) => {
      return mutate(...args);
    },
    [mutate],
  );

  return [optimisticMutate, result] as MutationTuple<TData, TVariables>;
}

