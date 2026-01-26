/**
 * Custom hook for fetching accounts
 * Provides accounts data with loading and error states
 */

import { useQuery } from '@apollo/client/react';
import { useEffect } from 'react';
import { GET_ACCOUNTS } from '../graphql/queries';
import { useWorkspace } from '../contexts/WorkspaceContext';

/**
 * Account type from GraphQL query
 */
export interface Account {
  id: string;
  name: string;
  initBalance: number;
  isDefault: boolean;
  accountType: 'Cash' | 'CreditCard' | 'Bank' | 'Saving' | 'Loans';
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
interface GetAccountsData {
  accounts?: Account[];
}

export function useAccounts(): UseAccountsResult {
  const { activeWorkspaceId } = useWorkspace();
  const { data, loading, error, refetch } = useQuery<GetAccountsData>(GET_ACCOUNTS, {
    errorPolicy: 'all',
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  });

  /**
   * Refetch accounts when workspace changes
   * The cache is cleared in WorkspaceContext, but we explicitly refetch to ensure fresh data
   */
  useEffect(() => {
    if (activeWorkspaceId !== null) {
      void refetch();
    }
  }, [activeWorkspaceId, refetch]);

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

  const accounts = data?.accounts ?? [];

  return {
    accounts,
    loading: Boolean(loading),
    error: errorResult,
    refetch: (): void => {
      void refetch();
    },
  };
}
