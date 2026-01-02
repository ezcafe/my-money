/**
 * Custom hook for fetching a single budget
 * Provides budget data with loading and error states
 */

import {useQuery} from '@apollo/client/react';
import {GET_BUDGET} from '../graphql/queries';

/**
 * Budget type from GraphQL query
 */
export interface Budget {
  id: string;
  userId: string;
  amount: string;
  currentSpent: string;
  accountId: string | null;
  categoryId: string | null;
  payeeId: string | null;
  account: {
    id: string;
    name: string;
  } | null;
  category: {
    id: string;
    name: string;
    type: string;
  } | null;
  payee: {
    id: string;
    name: string;
  } | null;
  percentageUsed: number;
  lastResetDate: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook return type
 */
export interface UseBudgetResult {
  budget: Budget | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Custom hook to fetch a single budget
 * @param id - Budget ID
 * @returns Budget data with loading and error states
 */
interface GetBudgetData {
  budget?: Budget;
}

export function useBudget(id: string | undefined): UseBudgetResult {
  const {data, loading, error, refetch} = useQuery<GetBudgetData>(GET_BUDGET, {
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
    budget: data?.budget,
    loading: Boolean(loading),
    error: errorResult,
    refetch: (): void => {
      void refetch();
    },
  };
}

