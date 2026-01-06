/**
 * Custom hook for fetching a single category
 * Provides category data with loading and error states
 */

import {GET_CATEGORY} from '../graphql/queries';
import {useEntity} from './useEntity';

/**
 * Category type from GraphQL query
 */
export interface Category {
  id: string;
  name: string;
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
  const {entity, loading, error, refetch} = useEntity<Category, GetCategoryData>({
    query: GET_CATEGORY,
    variables: {id},
    skip: !id,
    errorPolicy: 'all',
    extractEntity: (data) => data.category,
  });

  return {
    category: entity,
    loading,
    error,
    refetch,
  };
}

