/**
 * Custom hook for fetching a single payee
 * Provides payee data with loading and error states
 */

import {useQuery} from '@apollo/client/react';
import {GET_PAYEE} from '../graphql/queries';

/**
 * Payee type from GraphQL query
 */
export interface Payee {
  id: string;
  name: string;
  icon?: string | null;
  isDefault: boolean;
}

/**
 * Hook return type
 */
export interface UsePayeeResult {
  payee: Payee | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Custom hook to fetch a single payee
 * @param id - Payee ID
 * @returns Payee data with loading and error states
 */
interface GetPayeeData {
  payee?: Payee;
}

export function usePayee(id: string | undefined): UsePayeeResult {
  const {data, loading, error, refetch} = useQuery<GetPayeeData>(GET_PAYEE, {
    variables: {id},
    skip: !id,
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
    payee: data?.payee,
    loading: Boolean(loading),
    error: errorResult,
    refetch: (): void => {
      void refetch();
    },
  };
}

