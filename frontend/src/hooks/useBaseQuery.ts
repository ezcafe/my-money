/**
 * Base Query Hook
 * Provides consistent error handling pattern for Apollo queries
 */

import {useQuery, type QueryHookOptions, type QueryResult} from '@apollo/client/react';
import type {DocumentNode, OperationVariables} from '@apollo/client';
import {getUserFriendlyErrorMessage} from '../utils/errorNotification';

/**
 * Standardized error type
 */
export interface QueryError {
  message: string;
  originalError?: unknown;
}

/**
 * Base query hook result with standardized error handling
 */
export interface UseBaseQueryResult<TData, TVariables extends OperationVariables> {
  data: TData | undefined;
  loading: boolean;
  error: QueryError | undefined;
  refetch: () => Promise<QueryResult<TData, TVariables>>;
  queryResult: QueryResult<TData, TVariables>;
}

/**
 * Base query hook with consistent error handling
 * @param query - GraphQL query document
 * @param options - Apollo query options
 * @returns Query result with standardized error handling
 */
export function useBaseQuery<TData = unknown, TVariables extends OperationVariables = OperationVariables>(
  query: DocumentNode,
  options?: QueryHookOptions<TData, TVariables>,
): UseBaseQueryResult<TData, TVariables> {
  const queryResult = useQuery<TData, TVariables>(query, {
    errorPolicy: 'all',
    ...options,
  } as QueryHookOptions<TData, TVariables>);

  const {data, loading, error, refetch} = queryResult;

  // Standardize error handling
  let standardizedError: QueryError | undefined;
  if (error) {
    const errorMessage = getUserFriendlyErrorMessage(error);
    standardizedError = {
      message: errorMessage,
      originalError: error,
    };
  }

  return {
    data: data as TData | undefined, // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
    loading: Boolean(loading),
    error: standardizedError,
    refetch: async (): Promise<QueryResult<TData, TVariables>> => {
      return refetch() as unknown as Promise<QueryResult<TData, TVariables>>;
    },
    queryResult: queryResult as QueryResult<TData, TVariables>,
  };
}

