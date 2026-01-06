/**
 * Custom hook for fetching a single payee
 * Provides payee data with loading and error states
 */

import {GET_PAYEE} from '../graphql/queries';
import {useEntity} from './useEntity';

/**
 * Payee type from GraphQL query
 */
export interface Payee {
  id: string;
  name: string;
  isDefault: boolean;
}

/**
 * Hook return type
 */
export interface UsePayeeResult {
  payee: Payee | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Custom hook to fetch a single payee
 * @param id - Payee ID
 * @returns Payee data with loading and error states
 */
interface GetPayeeData {
  payee?: Payee;
}

export function usePayee(id: string | undefined): UsePayeeResult {
  const {entity, loading, error, refetch} = useEntity<Payee, GetPayeeData>({
    query: GET_PAYEE,
    variables: {id},
    skip: !id,
    errorPolicy: 'all',
    extractEntity: (data) => data.payee,
  });

  return {
    payee: entity,
    loading,
    error,
    refetch,
  };
}

