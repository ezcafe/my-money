/**
 * Custom hook for subscribing to transaction updates
 * Provides real-time transaction updates via GraphQL subscriptions
 */

import { useSubscription } from '@apollo/client/react';
import { TRANSACTION_UPDATED_SUBSCRIPTION } from '../graphql/subscriptions';
import { client } from '../graphql/client';
import type { Transaction } from './useTransactions';

/**
 * Hook return type
 */
export interface UseTransactionSubscriptionResult {
  transaction: Transaction | null;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Custom hook to subscribe to transaction updates
 * @param workspaceId - Workspace ID to filter updates
 * @returns Transaction update data with loading and error states
 */
interface TransactionUpdatedData {
  transactionUpdated: Transaction;
}

export function useTransactionSubscription(workspaceId: string): UseTransactionSubscriptionResult {
  const { data, loading, error } = useSubscription<TransactionUpdatedData>(
    TRANSACTION_UPDATED_SUBSCRIPTION,
    {
      variables: { workspaceId },
      onData: ({ data: subscriptionData }) => {
        if (subscriptionData?.data?.transactionUpdated) {
          // Update Apollo cache with new transaction data
          const transaction = subscriptionData.data.transactionUpdated;
          client.cache.writeQuery({
            query: TRANSACTION_UPDATED_SUBSCRIPTION,
            variables: { workspaceId },
            data: { transactionUpdated: transaction },
          });
        }
      },
      errorPolicy: 'all',
      shouldResubscribe: true,
    }
  );

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
    transaction: data?.transactionUpdated ?? null,
    loading: Boolean(loading),
    error: errorResult,
  };
}
