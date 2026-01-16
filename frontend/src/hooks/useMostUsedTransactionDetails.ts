/**
 * Custom hook for fetching most used transaction details for a specific amount
 * Provides account, payee, and category that were most commonly used with the amount
 */

import {useState, useEffect, useRef} from 'react';
import {useLazyQuery} from '@apollo/client/react';
import {GET_MOST_USED_TRANSACTION_DETAILS} from '../graphql/queries';
import {debounce} from '../utils/rateLimiting';

/**
 * Most used transaction details type from GraphQL query
 */
export interface MostUsedTransactionDetails {
  accountId: string | null;
  payeeId: string | null;
  categoryId: string | null;
  count: number;
}

/**
 * Hook return type for most used transaction details
 */
export interface UseMostUsedTransactionDetailsResult {
  accountId: string | null;
  payeeId: string | null;
  categoryId: string | null;
  loading: boolean;
  error: Error | undefined;
}

interface GetMostUsedTransactionDetailsData {
  mostUsedTransactionDetails?: MostUsedTransactionDetails | null;
}

/**
 * Custom hook to fetch most commonly used account, payee, and category for a specific amount
 * @param amount - Transaction amount to query (null or 0 to skip query)
 * @param days - Number of days to look back (default: 90)
 * @returns Most used transaction details with loading and error states
 */
export function useMostUsedTransactionDetails(
  amount: number | null,
  days: number = 90,
): UseMostUsedTransactionDetailsResult {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [payeeId, setPayeeId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const [fetchDetails, {loading: queryLoading, error: queryError, data: queryData}] = useLazyQuery<GetMostUsedTransactionDetailsData>(
    GET_MOST_USED_TRANSACTION_DETAILS,
    {
      errorPolicy: 'all',
    },
  );

  // Update loading state when query loading changes
  useEffect(() => {
    setLoading(queryLoading);
  }, [queryLoading]);

  // Handle query data when it's available
  useEffect(() => {
    if (queryData) {
      const details = queryData.mostUsedTransactionDetails;
      if (details) {
        setAccountId(details.accountId);
        setPayeeId(details.payeeId);
        setCategoryId(details.categoryId);
      } else {
        // No matches found, clear selections
        setAccountId(null);
        setPayeeId(null);
        setCategoryId(null);
      }
      setLoading(false);
    }
  }, [queryData]);

  // Update error state when query error changes
  useEffect(() => {
    if (queryError) {
      let errorResult: Error | undefined;
      if (queryError instanceof Error) {
        errorResult = queryError;
      } else if (queryError && typeof queryError === 'object' && 'message' in queryError) {
        errorResult = new Error(String(queryError.message));
      } else {
        errorResult = new Error('An unknown error occurred');
      }
      setError(errorResult);
      setLoading(false);
    } else {
      setError(undefined);
    }
  }, [queryError]);

  // Create debounced fetch function
  const debouncedFetch = useRef(
    debounce((...args: unknown[]) => {
      const [amountValue, daysValue] = args as [number, number];
      if (amountValue > 0) {
        setLoading(true);
        void fetchDetails({
          variables: {
            amount: amountValue,
            days: daysValue,
          },
        });
      } else {
        // Clear selections if amount is 0 or invalid
        setAccountId(null);
        setPayeeId(null);
        setCategoryId(null);
        setLoading(false);
      }
    }, 300), // 300ms debounce delay
  ).current;

  // Trigger query when amount changes
  useEffect(() => {
    if (amount !== null && amount > 0) {
      debouncedFetch(amount, days);
    } else {
      // Clear selections if amount is null or 0
      setAccountId(null);
      setPayeeId(null);
      setCategoryId(null);
      setLoading(false);
    }
  }, [amount, days, debouncedFetch]);

  return {
    accountId,
    payeeId,
    categoryId,
    loading,
    error,
  };
}
