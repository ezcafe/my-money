/**
 * Calculator Transaction Hook
 * Handles transaction creation, auto-selection, and default values
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation } from '@apollo/client/react';
import { CREATE_TRANSACTION } from '../graphql/mutations';
import { GET_RECENT_TRANSACTIONS } from '../graphql/queries';
import { useAccounts } from './useAccounts';
import { useCategories } from './useCategories';
import { usePayees } from './usePayees';
import { useMostUsedTransactionDetails } from './useMostUsedTransactionDetails';
import { useNotifications } from '../contexts/NotificationContext';

/**
 * Calculator transaction hook return type
 */
export interface UseCalculatorTransactionReturn {
  selectedAccountId: string;
  selectedCategoryId: string;
  selectedPayeeId: string;
  setSelectedAccountId: (id: string) => void;
  setSelectedCategoryId: (id: string) => void;
  setSelectedPayeeId: (id: string) => void;
  createTransaction: (amount: number) => Promise<void>;
  creating: boolean;
  error: string | null;
}

/**
 * Hook for managing calculator transaction creation and selection
 * @param currentAmount - Current amount from calculator display (for auto-selection)
 * @param onTransactionCreated - Callback when transaction is successfully created
 * @returns Transaction creation functions and selected IDs
 */
export function useCalculatorTransaction(
  currentAmount: number | null,
  onTransactionCreated?: () => void
): UseCalculatorTransactionReturn {
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { payees } = usePayees();
  const { showSuccessNotification } = useNotifications();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedPayeeId, setSelectedPayeeId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Get default account ID
  const defaultAccountId = useMemo(() => {
    if (accounts.length === 0) {
      return null;
    }
    const defaultAccount = accounts.find((acc) => acc.isDefault) ?? accounts[0];
    return defaultAccount?.id ?? null;
  }, [accounts]);

  // Get default category ID (Food & Groceries)
  const defaultCategoryId = useMemo(() => {
    const defaultCategory = categories.find(
      (cat) => cat.name === 'Food & Groceries' && cat.categoryType === 'Expense'
    );
    return defaultCategory?.id ?? null;
  }, [categories]);

  // Get default payee ID
  const defaultPayeeId = useMemo(() => {
    if (payees.length === 0) {
      return null;
    }
    const defaultPayee = payees.find((p) => p.isDefault) ?? payees[0];
    return defaultPayee?.id ?? null;
  }, [payees]);

  // Fetch most used transaction details for current amount
  const {
    accountId: autoAccountId,
    payeeId: autoPayeeId,
    categoryId: autoCategoryId,
  } = useMostUsedTransactionDetails(currentAmount, 90);

  // Refs to apply defaults only when data first becomes available (not when user clears)
  const hasAccountsDefaultAppliedRef = useRef(false);
  const hasCategoriesDefaultAppliedRef = useRef(false);
  const hasPayeesDefaultAppliedRef = useRef(false);

  // Initialize selected values with defaults only when data first loads
  useEffect(() => {
    if (hasAccountsDefaultAppliedRef.current) {
      return;
    }
    if (accounts.length > 0 && defaultAccountId && selectedAccountId === '') {
      setSelectedAccountId(defaultAccountId);
      hasAccountsDefaultAppliedRef.current = true;
    }
  }, [accounts, defaultAccountId, selectedAccountId]);

  useEffect(() => {
    if (hasCategoriesDefaultAppliedRef.current) {
      return;
    }
    if (categories.length > 0 && defaultCategoryId && selectedCategoryId === '') {
      setSelectedCategoryId(defaultCategoryId);
      hasCategoriesDefaultAppliedRef.current = true;
    }
  }, [categories, defaultCategoryId, selectedCategoryId]);

  useEffect(() => {
    if (hasPayeesDefaultAppliedRef.current) {
      return;
    }
    if (payees.length > 0 && defaultPayeeId && selectedPayeeId === '') {
      setSelectedPayeeId(defaultPayeeId);
      hasPayeesDefaultAppliedRef.current = true;
    }
  }, [payees, defaultPayeeId, selectedPayeeId]);

  // Auto-select account, payee, and category when most used details are fetched
  useEffect(() => {
    // Only auto-select if we have a valid amount and fetched details
    if (currentAmount === null) {
      return;
    }

    // Auto-select account if available and valid
    if (autoAccountId && accounts.some((acc) => acc.id === autoAccountId)) {
      setSelectedAccountId(autoAccountId);
    }

    // Auto-select category if available and valid
    if (autoCategoryId && categories.some((cat) => cat.id === autoCategoryId)) {
      setSelectedCategoryId(autoCategoryId);
    }

    // Auto-select payee if available and valid
    if (autoPayeeId && payees.some((payee) => payee.id === autoPayeeId)) {
      setSelectedPayeeId(autoPayeeId);
    }
  }, [autoAccountId, autoCategoryId, autoPayeeId, currentAmount, accounts, categories, payees]);

  const [createTransactionMutation, { loading: creating }] = useMutation(CREATE_TRANSACTION, {
    refetchQueries: [{ query: GET_RECENT_TRANSACTIONS }],
    awaitRefetchQueries: true,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: (data: unknown) => {
      const payload = data as { createTransaction?: { id?: string } };
      const id = payload?.createTransaction?.id;
      if (id) {
        showSuccessNotification('Transaction added', {
          label: 'View',
          href: `/transactions/${id}/edit`,
        });
      }
      setError(null);
      onTransactionCreated?.();
    },
  });

  /**
   * Create a transaction with the given amount
   */
  const createTransaction = useCallback(
    async (amount: number): Promise<void> => {
      const transactionInput: {
        value: number;
        accountId: string | null;
        categoryId: string | null;
        payeeId?: string | null;
        date: string;
      } = {
        value: amount,
        accountId: selectedAccountId || defaultAccountId,
        categoryId: selectedCategoryId || defaultCategoryId,
        date: new Date().toISOString(),
      };

      // Only include payeeId if it's not null
      const payeeIdToUse = selectedPayeeId || defaultPayeeId;
      if (payeeIdToUse) {
        transactionInput.payeeId = payeeIdToUse;
      }

      await createTransactionMutation({
        variables: {
          input: transactionInput,
        },
      });
    },
    [
      selectedAccountId,
      selectedCategoryId,
      selectedPayeeId,
      defaultAccountId,
      defaultCategoryId,
      defaultPayeeId,
      createTransactionMutation,
    ]
  );

  return {
    selectedAccountId,
    selectedCategoryId,
    selectedPayeeId,
    setSelectedAccountId,
    setSelectedCategoryId,
    setSelectedPayeeId,
    createTransaction,
    creating,
    error,
  };
}
