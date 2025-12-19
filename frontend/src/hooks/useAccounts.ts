/**
 * Custom hook for fetching accounts
 * Provides accounts data with loading and error states
 */

import {useQuery} from '@apollo/client';
import {GET_ACCOUNTS} from '../graphql/queries';

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
export interface UseAccountsResult {
  accounts: Account[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Custom hook to fetch accounts
 * @returns Accounts data with loading and error states
 */
export function useAccounts(): UseAccountsResult {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const {data, loading, error, refetch} = useQuery(GET_ACCOUNTS, {
    errorPolicy: 'all',
  });

  let errorResult: Error | undefined;
  if (error) {
    errorResult = error instanceof Error ? error : new Error(String(error));
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    accounts: (data?.accounts as Account[] | undefined) ?? [],
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    loading,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    error: errorResult,
    refetch: (): void => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      void refetch();
    },
  };
}

