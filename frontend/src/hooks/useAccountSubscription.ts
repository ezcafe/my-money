/**
 * Custom hook for subscribing to account updates
 * Provides real-time account updates via GraphQL subscriptions
 */

import {useSubscription} from '@apollo/client/react';
import {ACCOUNT_UPDATED_SUBSCRIPTION} from '../graphql/subscriptions';
import {client} from '../graphql/client';
import type {Account} from './useAccounts';

/**
 * Hook return type
 */
export interface UseAccountSubscriptionResult {
  account: Account | null;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Custom hook to subscribe to account updates
 * @param workspaceId - Workspace ID to filter updates
 * @returns Account update data with loading and error states
 */
interface AccountUpdatedData {
  accountUpdated: Account;
}

export function useAccountSubscription(workspaceId: string): UseAccountSubscriptionResult {
  const {data, loading, error} = useSubscription<AccountUpdatedData>(ACCOUNT_UPDATED_SUBSCRIPTION, {
    variables: {workspaceId},
    onData: ({data: subscriptionData}) => {
      if (subscriptionData?.data?.accountUpdated) {
        // Update Apollo cache with new account data
        // This will automatically update any components using the account
        const account = subscriptionData.data.accountUpdated;
        client.cache.writeQuery({
          query: ACCOUNT_UPDATED_SUBSCRIPTION,
          variables: {workspaceId},
          data: {accountUpdated: account},
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
    account: data?.accountUpdated ?? null,
    loading: Boolean(loading),
    error: errorResult,
  };
}
