/**
 * Custom hook for fetching payees
 * Provides payees data with loading and error states
 */

import {useQuery} from '@apollo/client/react';
import {GET_PAYEES} from '../graphql/queries';

/**
 * Payee type from GraphQL query
 */
export interface Payee {
  id: string;
  name: string;
  isDefault: boolean;
}

/**
 * Hook return type
 */
export interface UsePayeesResult {
  payees: Payee[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Custom hook to fetch payees
 * @returns Payees data with loading and error states
 */
interface GetPayeesData {
  payees?: Payee[];
}

export function usePayees(): UsePayeesResult {
  const {data, loading, error, refetch} = useQuery<GetPayeesData>(GET_PAYEES, {
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
    payees: data?.payees ?? [],
    loading: Boolean(loading),
    error: errorResult,
    refetch: (): void => {
      void refetch();
    },
  };
}

