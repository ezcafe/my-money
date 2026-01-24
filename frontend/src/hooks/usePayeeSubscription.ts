/**
 * Custom hook for subscribing to payee updates
 * Provides real-time payee updates via GraphQL subscriptions
 */

import { useSubscription } from '@apollo/client/react';
import { PAYEE_UPDATED_SUBSCRIPTION } from '../graphql/subscriptions';
import { client } from '../graphql/client';
import type { Payee } from './usePayees';

/**
 * Hook return type
 */
export interface UsePayeeSubscriptionResult {
  payee: Payee | null;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Custom hook to subscribe to payee updates
 * @param workspaceId - Workspace ID to filter updates
 * @returns Payee update data with loading and error states
 */
interface PayeeUpdatedData {
  payeeUpdated: Payee;
}

export function usePayeeSubscription(workspaceId: string): UsePayeeSubscriptionResult {
  const { data, loading, error } = useSubscription<PayeeUpdatedData>(PAYEE_UPDATED_SUBSCRIPTION, {
    variables: { workspaceId },
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData?.data?.payeeUpdated) {
        // Update Apollo cache with new payee data
        const payee = subscriptionData.data.payeeUpdated;
        client.cache.writeQuery({
          query: PAYEE_UPDATED_SUBSCRIPTION,
          variables: { workspaceId },
          data: { payeeUpdated: payee },
        });
      }
    },
    errorPolicy: 'all',
    shouldResubscribe: true,
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
    payee: data?.payeeUpdated ?? null,
    loading: Boolean(loading),
    error: errorResult,
  };
}
