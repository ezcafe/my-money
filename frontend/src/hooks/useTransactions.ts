/**
 * Custom hook for fetching transactions
 * Provides transactions data with loading and error states
 */

import {useQuery} from '@apollo/client';
import {GET_RECENT_TRANSACTIONS, GET_TRANSACTIONS} from '../graphql/queries';

/**
 * Transaction type from GraphQL query
 */
export interface Transaction {
  id: string;
  value: number;
  date: Date | string;
  account?: {
    id: string;
    name: string;
  } | null;
  category?: {
    id: string;
    name: string;
    icon?: string | null;
  } | null;
  payee?: {
    id: string;
    name: string;
    icon?: string | null;
  } | null;
  note?: string | null;
}

/**
 * Paginated transactions result
 */
export interface PaginatedTransactions {
  items: Transaction[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Hook return type for recent transactions
 */
export interface UseRecentTransactionsResult {
  transactions: Transaction[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Hook return type for paginated transactions
 */
export interface UseTransactionsResult {
  transactions: PaginatedTransactions;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Custom hook to fetch recent transactions
 * @param limit - Maximum number of transactions to fetch (default: 30)
 * @returns Recent transactions with loading and error states
 */
export function useRecentTransactions(limit: number = 30): UseRecentTransactionsResult {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const {data, loading, error, refetch} = useQuery(GET_RECENT_TRANSACTIONS, {
    variables: {limit},
    errorPolicy: 'all',
  });

  let errorResult: Error | undefined;
  if (error) {
    errorResult = error instanceof Error ? error : new Error(String(error));
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    transactions: (data?.recentTransactions as Transaction[] | undefined) ?? [],
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

/**
 * Custom hook to fetch paginated transactions
 * @param accountId - Optional account ID to filter by
 * @param skip - Number of items to skip
 * @param take - Number of items to take
 * @returns Paginated transactions with loading and error states
 */
export function useTransactions(
  accountId?: string,
  skip: number = 0,
  take: number = 20,
): UseTransactionsResult {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const {data, loading, error, refetch} = useQuery(GET_TRANSACTIONS, {
    variables: {accountId, skip, take},
    errorPolicy: 'all',
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const transactionsData = data?.transactions as PaginatedTransactions | undefined;
  
  let errorResult: Error | undefined;
  if (error) {
    errorResult = error instanceof Error ? error : new Error(String(error));
  }

  return {
    transactions: {
      items: transactionsData?.items ?? [],
      totalCount: transactionsData?.totalCount ?? 0,
      hasMore: transactionsData?.hasMore ?? false,
      nextCursor: transactionsData?.nextCursor,
    },
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

