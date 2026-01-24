/**
 * Generic Entity Hook
 * Provides reusable entity fetching logic for Account, Category, Payee, etc.
 * Reduces code duplication and ensures consistent error handling
 */

import { useQuery } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';

/**
 * Hook return type
 */
export interface UseEntityResult<T> {
  entity: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Options for useEntity hook
 */
interface UseEntityOptions<T, TData> {
  /** GraphQL query document */
  query: DocumentNode;
  /** Query variables */
  variables?: Record<string, unknown>;
  /** Whether to skip the query */
  skip?: boolean;
  /** Error policy */
  errorPolicy?: 'none' | 'ignore' | 'all';
  /** Function to extract entity from query data */
  extractEntity: (data: TData) => T | undefined;
}

/**
 * Generic hook to fetch a single entity
 * @param options - Entity query options
 * @returns Entity data with loading and error states
 */
export function useEntity<T, TData = Record<string, T | undefined>>(
  options: UseEntityOptions<T, TData>
): UseEntityResult<T> {
  const { query, variables, skip = false, errorPolicy = 'all', extractEntity } = options;

  const { data, loading, error, refetch } = useQuery<TData>(query, {
    variables,
    skip,
    errorPolicy,
  });

  let errorResult: Error | undefined;
  if (error) {
    if (error instanceof Error) {
      errorResult = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorResult = new Error(String(error.message));
    } else {
      errorResult = new Error('An unknown error occurred');
    }
  }

  const entity = data ? extractEntity(data) : undefined;

  return {
    entity,
    loading: Boolean(loading),
    error: errorResult,
    refetch: (): void => {
      void refetch();
    },
  };
}
