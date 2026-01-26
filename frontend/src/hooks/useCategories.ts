/**
 * Custom hook for fetching categories
 * Provides categories data with loading and error states
 */

import { useQuery } from '@apollo/client/react';
import { useEffect } from 'react';
import { GET_CATEGORIES } from '../graphql/queries';
import { useWorkspace } from '../contexts/WorkspaceContext';

/**
 * Category type from GraphQL query
 */
export interface Category {
  id: string;
  name: string;
  categoryType: 'Income' | 'Expense';
  isDefault: boolean;
}

/**
 * Hook return type
 */
export interface UseCategoriesResult {
  categories: Category[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Custom hook to fetch categories
 * @returns Categories data with loading and error states
 */
interface GetCategoriesData {
  categories?: Category[];
}

export function useCategories(): UseCategoriesResult {
  const { activeWorkspaceId } = useWorkspace();
  const { data, loading, error, refetch } = useQuery<GetCategoriesData>(GET_CATEGORIES, {
    errorPolicy: 'all',
    fetchPolicy: 'network-only',
  });

  /**
   * Refetch categories when workspace changes
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

  const categories = data?.categories ?? [];

  return {
    categories,
    loading: Boolean(loading),
    error: errorResult,
    refetch: (): void => {
      void refetch();
    },
  };
}
