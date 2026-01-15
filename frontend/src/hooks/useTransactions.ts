/**
 * Custom hook for fetching transactions
 * Provides transactions data with loading and error states
 */

import {useQuery} from '@apollo/client/react';
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
  } | null;
  payee?: {
    id: string;
    name: string;
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

interface GetRecentTransactionsData {
  recentTransactions?: Transaction[];
}

/**
 * Transaction order by field type
 */
export type TransactionOrderByField = 'date' | 'value' | 'category' | 'account' | 'payee';

/**
 * Transaction order input type
 */
export interface TransactionOrderInput {
  field: TransactionOrderByField;
  direction: 'asc' | 'desc';
}

/**
 * Custom hook to fetch recent transactions
 * @param limit - Maximum number of transactions to fetch (default: 30)
 * @param orderBy - Ordering configuration with field and direction (default: {field: 'date', direction: 'asc'})
 * @returns Recent transactions with loading and error states
 */
export function useRecentTransactions(
  limit: number = 30,
  orderBy: TransactionOrderInput = {field: 'date', direction: 'asc'},
): UseRecentTransactionsResult {
  const {data, loading, error, refetch} = useQuery<GetRecentTransactionsData>(GET_RECENT_TRANSACTIONS, {
    variables: {limit, orderBy},
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
    transactions: data?.recentTransactions ?? [],
    loading: Boolean(loading),
    error: errorResult,
    refetch: (): void => {
      void refetch();
    },
  };
}

interface GetTransactionsData {
  transactions?: PaginatedTransactions;
}

/**
 * Custom hook to fetch paginated transactions
 * @param accountId - Optional account ID to filter by
 * @param categoryId - Optional category ID to filter by
 * @param payeeId - Optional payee ID to filter by
 * @param first - Number of items to fetch (default: 20)
 * @param after - Cursor for pagination (from previous page's nextCursor)
 * @param orderBy - Optional ordering configuration
 * @param note - Optional note filter for searching
 * @param querySkip - Whether to skip the query (e.g., when required filter is missing)
 * @returns Paginated transactions with loading and error states
 */
export function useTransactions(
  accountId?: string,
  categoryId?: string,
  payeeId?: string,
  first: number = 20,
  after?: string,
  orderBy?: TransactionOrderInput,
  note?: string,
  querySkip?: boolean,
): UseTransactionsResult {
  const {data, loading, error, refetch} = useQuery<GetTransactionsData>(GET_TRANSACTIONS, {
    variables: {accountId, categoryId, payeeId, first, after, orderBy, note},
    errorPolicy: 'all',
    skip: querySkip ?? false,
  });

  const transactionsData = data?.transactions;

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
    transactions: {
      items: transactionsData?.items ?? [],
      totalCount: transactionsData?.totalCount ?? 0,
      hasMore: transactionsData?.hasMore ?? false,
      nextCursor: transactionsData?.nextCursor,
    },
    loading: Boolean(loading),
    error: errorResult,
    refetch: (): void => {
      void refetch();
    },
  };
}

