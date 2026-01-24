/**
 * Custom hook for subscribing to category updates
 * Provides real-time category updates via GraphQL subscriptions
 */

import { useSubscription } from '@apollo/client/react';
import { CATEGORY_UPDATED_SUBSCRIPTION } from '../graphql/subscriptions';
import { client } from '../graphql/client';
import type { Category } from './useCategories';

/**
 * Hook return type
 */
export interface UseCategorySubscriptionResult {
  category: Category | null;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Custom hook to subscribe to category updates
 * @param workspaceId - Workspace ID to filter updates
 * @returns Category update data with loading and error states
 */
interface CategoryUpdatedData {
  categoryUpdated: Category;
}

export function useCategorySubscription(workspaceId: string): UseCategorySubscriptionResult {
  const { data, loading, error } = useSubscription<CategoryUpdatedData>(
    CATEGORY_UPDATED_SUBSCRIPTION,
    {
      variables: { workspaceId },
      onData: ({ data: subscriptionData }) => {
        if (subscriptionData?.data?.categoryUpdated) {
          // Update Apollo cache with new category data
          const category = subscriptionData.data.categoryUpdated;
          client.cache.writeQuery({
            query: CATEGORY_UPDATED_SUBSCRIPTION,
            variables: { workspaceId },
            data: { categoryUpdated: category },
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
    category: data?.categoryUpdated ?? null,
    loading: Boolean(loading),
    error: errorResult,
  };
}
