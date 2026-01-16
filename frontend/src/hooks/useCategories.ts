/**
 * Custom hook for fetching categories
 * Provides categories data with loading and error states
 */

import {useQuery} from '@apollo/client/react';
import {GET_CATEGORIES} from '../graphql/queries';

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
  const {data, loading, error, refetch} = useQuery<GetCategoriesData>(GET_CATEGORIES, {
    errorPolicy: 'all',
    fetchPolicy: 'network-only',
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

