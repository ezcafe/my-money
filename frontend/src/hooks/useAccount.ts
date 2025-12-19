/**
 * Custom hook for fetching a single account
 * Provides account data with loading and error states
 */

import {useQuery} from '@apollo/client/react';
import {GET_ACCOUNT} from '../graphql/queries';

/**
 * Account type from GraphQL query
 */
export interface Account {
  id: string;
  name: string;
  initBalance: number;
  isDefault: boolean;
  balance: number;
}

/**
 * Hook return type
 */
export interface UseAccountResult {
  account: Account | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Custom hook to fetch a single account
 * @param id - Account ID
 * @returns Account data with loading and error states
 */
interface GetAccountData {
  account?: Account;
}

export function useAccount(id: string | undefined): UseAccountResult {
  const {data, loading, error, refetch} = useQuery<GetAccountData>(GET_ACCOUNT, {
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
    account: data?.account,
    loading: Boolean(loading),
    error: errorResult,
    refetch: (): void => {
      void refetch();
    },
  };
}

