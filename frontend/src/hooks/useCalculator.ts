/**
 * Calculator Hook
 * Manages calculator state and operations
 */

import {useState, useCallback, useMemo} from 'react';
import {useMutation} from '@apollo/client/react';
import {CREATE_TRANSACTION} from '../graphql/mutations';
import {GET_RECENT_TRANSACTIONS} from '../graphql/queries';
import {useRecentTransactions} from './useTransactions';
import {useAccounts} from './useAccounts';
import {useCategories} from './useCategories';
import {usePayees} from './usePayees';
import {MAX_RECENT_TRANSACTIONS} from '../constants';

/**
 * Calculator state interface
 */
export interface CalculatorState {
  display: string;
  previousValue: number | null;
  operation: string | null;
  waitingForNewValue: boolean;
}

/**
 * Calculator hook return type
 */
export interface UseCalculatorReturn {
  state: CalculatorState;
  error: string | null;
  creatingTransaction: boolean;
  defaultAccountId: string | null;
  defaultCategoryId: string | null;
  defaultPayeeId: string | null;
  handleNumber: (num: string) => void;
  handleOperation: (op: string) => void;
  handleEquals: () => void;
  handleClear: () => void;
  handleBackspace: () => void;
  handlePlusMinus: () => void;
  handleSave: () => Promise<void>;
  setError: (error: string | null) => void;
  refetchRecentTransactions: () => void;
}

/**
 * Calculator hook
 * Manages calculator state and operations
 */
export function useCalculator(): UseCalculatorReturn {
  const {accounts} = useAccounts();
  const {categories} = useCategories();
  const {payees} = usePayees();
  const {refetch: refetchRecentTransactions} = useRecentTransactions(
    MAX_RECENT_TRANSACTIONS,
    {field: 'date', direction: 'desc'},
  );
  const [error, setError] = useState<string | null>(null);

  const [createTransaction, {loading: creatingTransaction}] = useMutation(CREATE_TRANSACTION, {
    refetchQueries: [{query: GET_RECENT_TRANSACTIONS}],
    awaitRefetchQueries: true,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      void refetchRecentTransactions();
    },
  });

  const [state, setState] = useState<CalculatorState>({
    display: '0',
    previousValue: null,
    operation: null,
    waitingForNewValue: false,
  });

  // Get default account ID
  const defaultAccountId = useMemo(() => {
    if (accounts.length === 0) {
      return null;
    }
    const defaultAccount = accounts.find((acc) => acc.isDefault) ?? accounts[0];
    return defaultAccount?.id ?? null;
  }, [accounts]);

  // Get default category ID
  const defaultCategoryId = useMemo(() => {
    const defaultCategory = categories.find(
      (cat) => cat.name === 'Default Expense Category' && cat.type === 'EXPENSE',
    );
    return defaultCategory?.id ?? null;
  }, [categories]);

  // Get default payee ID
  const defaultPayeeId = useMemo(() => {
    if (payees.length === 0) {
      return null;
    }
    const defaultPayee = payees.find((payee) => payee.isDefault) ?? payees[0];
    return defaultPayee?.id ?? null;
  }, [payees]);

  const handleNumber = useCallback((num: string) => {
    setState((prev) => {
      if (prev.waitingForNewValue) {
        return {
          ...prev,
          display: num,
          waitingForNewValue: false,
        };
      }
      return {
        ...prev,
        display: prev.display === '0' ? num : prev.display + num,
      };
    });
  }, []);

  const handleOperation = useCallback((op: string) => {
    setState((prev) => {
      const currentValue = parseFloat(prev.display);
      if (prev.previousValue === null) {
        return {
          ...prev,
          previousValue: currentValue,
          operation: op,
          waitingForNewValue: true,
        };
      }
      if (prev.operation && !prev.waitingForNewValue) {
        const result = calculate(prev.previousValue, currentValue, prev.operation);
        return {
          display: result.toString(),
          previousValue: result,
          operation: op,
          waitingForNewValue: true,
        };
      }
      return {
        ...prev,
        operation: op,
        waitingForNewValue: true,
      };
    });
  }, []);

  const handleEquals = useCallback(() => {
    setState((prev) => {
      if (prev.previousValue === null || prev.operation === null) {
        return prev;
      }
      const currentValue = parseFloat(prev.display);
      const result = calculate(prev.previousValue, currentValue, prev.operation);
      return {
        display: result.toString(),
        previousValue: null,
        operation: null,
        waitingForNewValue: true,
      };
    });
  }, []);

  const handleClear = useCallback(() => {
    setState({
      display: '0',
      previousValue: null,
      operation: null,
      waitingForNewValue: false,
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setState((prev) => {
      if (prev.waitingForNewValue) {
        return prev;
      }
      const newDisplay = prev.display.slice(0, -1);
      return {
        ...prev,
        display: newDisplay === '' ? '0' : newDisplay,
      };
    });
  }, []);

  const handlePlusMinus = useCallback(() => {
    setState((prev) => {
      if (prev.display === '0') {
        return prev;
      }
      const currentValue = parseFloat(prev.display);
      return {
        ...prev,
        display: (-currentValue).toString(),
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!defaultAccountId) {
      setError('No account available');
      return;
    }

    const value = parseFloat(state.display);
    if (isNaN(value) || value === 0) {
      setError('Invalid value');
      return;
    }

    try {
      await createTransaction({
        variables: {
          input: {
            value,
            accountId: defaultAccountId,
            categoryId: defaultCategoryId,
            payeeId: defaultPayeeId,
            date: new Date(),
          },
        },
      });
      handleClear();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    }
  }, [state.display, defaultAccountId, defaultCategoryId, defaultPayeeId, createTransaction, handleClear]);

  return {
    state,
    error,
    creatingTransaction,
    defaultAccountId,
    defaultCategoryId,
    defaultPayeeId,
    handleNumber,
    handleOperation,
    handleEquals,
    handleClear,
    handleBackspace,
    handlePlusMinus,
    handleSave,
    setError,
    refetchRecentTransactions,
  };
}

/**
 * Calculate result of two numbers with an operation
 */
function calculate(a: number, b: number, operation: string): number {
  switch (operation) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b !== 0 ? a / b : 0;
    default:
      return b;
  }
}

