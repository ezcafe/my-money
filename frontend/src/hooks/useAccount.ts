/**
 * Custom hook for fetching a single account
 * Provides account data with loading and error states
 */

import {useQuery} from '@apollo/client';
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
export function useAccount(id: string | undefined): UseAccountResult {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const {data, loading, error, refetch} = useQuery(GET_ACCOUNT, {
    variables: {id},
    skip: !id,
    errorPolicy: 'all',
  });

  let errorResult: Error | undefined;
  if (error) {
    errorResult = error instanceof Error ? error : new Error(String(error));
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    account: data?.account as Account | undefined,
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

