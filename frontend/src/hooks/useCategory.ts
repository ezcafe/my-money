/**
 * Custom hook for fetching a single category
 * Provides category data with loading and error states
 */

import {useQuery} from '@apollo/client/react';
import {GET_CATEGORY} from '../graphql/queries';

/**
 * Category type from GraphQL query
 */
export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  type: 'INCOME' | 'EXPENSE';
  isDefault: boolean;
}

/**
 * Hook return type
 */
export interface UseCategoryResult {
  category: Category | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Custom hook to fetch a single category
 * @param id - Category ID
 * @returns Category data with loading and error states
 */
interface GetCategoryData {
  category?: Category;
}

export function useCategory(id: string | undefined): UseCategoryResult {
  const {data, loading, error, refetch} = useQuery<GetCategoryData>(GET_CATEGORY, {
    variables: {id},
    skip: !id,
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
    category: data?.category,
    loading: Boolean(loading),
    error: errorResult,
    refetch: (): void => {
      void refetch();
    },
  };
}

