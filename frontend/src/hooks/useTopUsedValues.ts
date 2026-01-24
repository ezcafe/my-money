/**
 * Custom hook for fetching top used transaction values
 * Provides top 5 most used values with loading and error states
 */

import { useQuery } from '@apollo/client/react';
import { GET_TOP_USED_VALUES } from '../graphql/queries';

/**
 * Top used value type from GraphQL query
 * Value is string to preserve decimal precision from database
 */
export interface TopUsedValue {
  value: string;
  count: number;
}

/**
 * Hook return type for top used values
 */
export interface UseTopUsedValuesResult {
  topUsedValues: TopUsedValue[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

interface GetTopUsedValuesData {
  topUsedValues?: TopUsedValue[];
}

/**
 * Custom hook to fetch top 5 most used transaction values
 * @param days - Number of days to look back (default: 90)
 * @returns Top used values with loading and error states
 */
export function useTopUsedValues(days: number = 90): UseTopUsedValuesResult {
  const { data, loading, error, refetch } = useQuery<GetTopUsedValuesData>(GET_TOP_USED_VALUES, {
    variables: { days },
    errorPolicy: 'all',
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

  return {
    topUsedValues: data?.topUsedValues ?? [],
    loading: Boolean(loading),
    error: errorResult,
    refetch: (): void => {
      void refetch();
    },
  };
}
