/**
 * Custom hook for fetching a single account
 * Provides account data with loading and error states
 */

import { GET_ACCOUNT } from '../graphql/queries';
import { useEntity } from './useEntity';

/**
 * Account type from GraphQL query
 */
export interface Account {
  id: string;
  name: string;
  initBalance: number;
  isDefault: boolean;
  accountType: 'Cash' | 'CreditCard' | 'Bank' | 'Saving' | 'Loans';
  balance: number;
}

/**
 * Hook return type
 */
export interface UseAccountResult {
  account: Account | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Custom hook to fetch a single account
 * @param id - Account ID
 * @returns Account data with loading and error states
 */
interface GetAccountData {
  account?: Account;
}

export function useAccount(id: string | undefined): UseAccountResult {
  const { entity, loading, error, refetch } = useEntity<Account, GetAccountData>({
    query: GET_ACCOUNT,
    variables: { id },
    skip: !id,
    errorPolicy: 'all',
    extractEntity: (data) => data.account,
  });

  return {
    account: entity,
    loading,
    error,
    refetch,
  };
}
