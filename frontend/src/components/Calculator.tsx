/**
 * Calculator Component
 * Modern calculator UI with history list and operations
 */

import React, {useState, useCallback, useMemo, useRef, useEffect} from 'react';
import {Box, Grid, Alert, Stack} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import {useNavigate, useLocation} from 'react-router';
import {HistoryList} from './HistoryList';
import {CREATE_TRANSACTION} from '../graphql/mutations';
import {GET_PREFERENCES, GET_RECENT_TRANSACTIONS} from '../graphql/queries';
import {useRecentTransactions} from '../hooks/useTransactions';
import {useAccounts} from '../hooks/useAccounts';
import {useCategories} from '../hooks/useCategories';
import {usePayees} from '../hooks/usePayees';
import {useTopUsedValues} from '../hooks/useTopUsedValues';
import {useMostUsedTransactionDetails} from '../hooks/useMostUsedTransactionDetails';
import {useAutoScroll} from '../hooks/useAutoScroll';
import {MAX_RECENT_TRANSACTIONS} from '../constants';
import {CalculatorDisplay} from './calculator/CalculatorDisplay';
import {CalculatorKeypad} from './calculator/CalculatorKeypad';
import {CalculatorControls} from './calculator/CalculatorControls';
import {Card} from './ui/Card';

interface CalculatorState {
  display: string;
  previousValue: number | null;
  operation: string | null;
  waitingForNewValue: boolean;
}

/**
 * Calculator component
 */
export function Calculator(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const prevLocationRef = useRef<string>(location.pathname);
  const {accounts} = useAccounts();
  const {categories} = useCategories();
  const {payees} = usePayees();
  // Order by desc to get newest transactions first, then reverse for display (oldest first, newest at bottom)
  const {transactions, loading: transactionsLoading, refetch: refetchRecentTransactions} = useRecentTransactions(
    MAX_RECENT_TRANSACTIONS,
    {field: 'date', direction: 'desc'},
  );
  const {topUsedValues} = useTopUsedValues(90);
  const {data: preferencesData} = useQuery<{preferences?: {currency: string; useThousandSeparator: boolean}}>(GET_PREFERENCES);
  const currency = preferencesData?.preferences?.currency ?? 'USD';
  const useThousandSeparator = preferencesData?.preferences?.useThousandSeparator ?? true;
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
      // Manually refetch to ensure cache is updated with correct variables
      void refetchRecentTransactions();
    },
  });

  const [state, setState] = useState<CalculatorState>({
    display: '0',
    previousValue: null,
    operation: null,
    waitingForNewValue: false,
  });

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const historyListRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<HTMLDivElement>(null);
  const [calculatorHeight, setCalculatorHeight] = useState<number>(0);
  const [showAmount, setShowAmount] = useState<boolean>(false);
  const [selectedPayeeId, setSelectedPayeeId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Calculate current amount from display for auto-selection
  const currentAmount = useMemo(() => {
    if (!showAmount || state.display === '0') {
      return null;
    }
    const parsed = parseFloat(state.display);
    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
  }, [showAmount, state.display]);

  // Fetch most used transaction details for current amount
  const {accountId: autoAccountId, payeeId: autoPayeeId, categoryId: autoCategoryId} =
    useMostUsedTransactionDetails(currentAmount, 90);

  // Auto-scroll to bottom when transactions are loaded or new ones are added
  useAutoScroll(historyListRef, transactions, transactionsLoading);

  // Keyboard shortcuts refs (will be set after handlers are defined)
  const handleNumberRef = useRef<((num: string) => void) | undefined>(undefined);
  const handleOperationRef = useRef<((op: string) => void) | undefined>(undefined);
  const handleEqualsRef = useRef<(() => void) | undefined>(undefined);
  const handleBackspaceRef = useRef<(() => void) | undefined>(undefined);

  // Measure calculator height dynamically
  useEffect(() => {
    const updateCalculatorHeight = (): void => {
      if (calculatorRef.current) {
        const height = calculatorRef.current.offsetHeight;
        setCalculatorHeight(height);
      }
    };

    // Initial measurement
    updateCalculatorHeight();

    // Use ResizeObserver to detect height changes
    const resizeObserver = new ResizeObserver(() => {
      updateCalculatorHeight();
    });

    if (calculatorRef.current) {
      resizeObserver.observe(calculatorRef.current);
    }

    // Update on window resize as fallback
    window.addEventListener('resize', updateCalculatorHeight);

    return (): void => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCalculatorHeight);
    };
  }, []); // Only run once on mount, ResizeObserver handles updates

  // Refetch transactions when returning from edit page
  useEffect(() => {
    // If we navigated back from a different path (e.g., from edit page), refetch data
    if (prevLocationRef.current !== location.pathname && prevLocationRef.current.includes('/transactions/')) {
      void refetchRecentTransactions();
    }
    prevLocationRef.current = location.pathname;
  }, [location.pathname, refetchRecentTransactions]);

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
      (cat) => cat.name === 'Food & Groceries' && cat.categoryType === 'Expense',
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

  // Initialize selected values with defaults on first load
  // Set defaults when data is available and no selection has been made
  useEffect(() => {
    // Set default account when accounts are loaded and no account is selected
    if (accounts.length > 0 && defaultAccountId && selectedAccountId === '') {
      setSelectedAccountId(defaultAccountId);
    }
  }, [accounts, defaultAccountId, selectedAccountId]);

  useEffect(() => {
    // Set default category when categories are loaded and no category is selected
    if (categories.length > 0 && defaultCategoryId && selectedCategoryId === '') {
      setSelectedCategoryId(defaultCategoryId);
    }
  }, [categories, defaultCategoryId, selectedCategoryId]);

  useEffect(() => {
    // Set default payee when payees are loaded and no payee is selected
    if (payees.length > 0 && defaultPayeeId && selectedPayeeId === '') {
      setSelectedPayeeId(defaultPayeeId);
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

  const handleNumber = useCallback((num: string) => {
    setShowAmount(true);
    setState((prev) => {
      if (prev.waitingForNewValue) {
        return {
          ...prev,
          display: num,
          waitingForNewValue: false,
        };
      }
      // Handle decimal point
      if (num === '.') {
        // Don't add decimal if one already exists
        if (prev.display.includes('.')) {
          return prev;
        }
        return {
          ...prev,
          display: prev.display === '0' ? '0.' : `${prev.display}.`,
        };
      }
      return {
        ...prev,
        display: prev.display === '0' ? num : prev.display + num,
      };
    });
  }, []);

  const handleOperation = useCallback((op: string) => {
    setShowAmount(true);
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

      if (prev.operation) {
        let result: number;
        switch (prev.operation) {
          case '+':
            result = prev.previousValue + currentValue;
            break;
          case '-':
            result = prev.previousValue - currentValue;
            break;
          case '*':
            result = prev.previousValue * currentValue;
            break;
          case '/':
            result = prev.previousValue / currentValue;
            break;
          default:
            result = currentValue;
        }

        return {
          display: String(result),
          previousValue: op === '=' ? null : result,
          operation: op === '=' ? null : op,
          waitingForNewValue: op === '=' ? false : true,
        };
      }

      return {
        ...prev,
        operation: op,
        waitingForNewValue: true,
      };
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setState((prev) => {
      // If waiting for new value or display is '0', don't do anything
      if (prev.waitingForNewValue || prev.display === '0') {
        return prev;
      }

      // Remove last character
      const newDisplay = prev.display.slice(0, -1);

      // If display becomes empty or only contains minus sign, set to '0'
      if (newDisplay === '' || newDisplay === '-') {
        setShowAmount(false);
        return {
          ...prev,
          display: '0',
        };
      }

      return {
        ...prev,
        display: newDisplay,
      };
    });
  }, []);

  /**
   * Handle top used value button click
   * Sets the calculator display to the selected value
   */
  const handleTopUsedValueClick = useCallback((value: number) => {
    setShowAmount(true);
    setState((prev) => ({
      ...prev,
      display: String(value),
      waitingForNewValue: false,
    }));
  }, []);

  const handleEquals = useCallback(() => {
    setState((prev) => {
      const currentValue = parseFloat(prev.display);
      let result: number;

      if (prev.previousValue !== null && prev.operation) {
        switch (prev.operation) {
          case '+':
            result = prev.previousValue + currentValue;
            break;
          case '-':
            result = prev.previousValue - currentValue;
            break;
          case '*':
            result = prev.previousValue * currentValue;
            break;
          case '/':
            result = prev.previousValue / currentValue;
            break;
          default:
            result = currentValue;
        }
      } else {
        result = currentValue;
      }

      if (isNaN(result)) {
        setError('Invalid calculation result');
        return prev;
      }

      // Create transaction asynchronously
      const transactionInput: {
        value: number;
        accountId: string | null;
        categoryId: string | null;
        payeeId?: string | null;
        date: string;
      } = {
        value: result,
        accountId: selectedAccountId || defaultAccountId,
        categoryId: selectedCategoryId || defaultCategoryId,
        date: new Date().toISOString(),
      };

      // Only include payeeId if it's not null
      const payeeIdToUse = selectedPayeeId || defaultPayeeId;
      if (payeeIdToUse) {
        transactionInput.payeeId = payeeIdToUse;
      }

      createTransaction({
        variables: {
          input: transactionInput,
        },
      })
        .then(() => {
          // Reset calculator after successful transaction
          setState({
            display: '0',
            previousValue: null,
            operation: null,
            waitingForNewValue: false,
          });
          setShowAmount(false);
          // Scroll will be handled by useEffect when transactions update
        })
        .catch(() => {
          // Error handled by onError callback
        });

      return {
        display: String(result),
        previousValue: null,
        operation: null,
        waitingForNewValue: false,
      };
    });
  }, [selectedAccountId, selectedCategoryId, selectedPayeeId, defaultAccountId, defaultCategoryId, defaultPayeeId, createTransaction]);

  /**
   * Memoized callback for payee change
   */
  const handlePayeeChange = useCallback((value: string) => {
    setSelectedPayeeId(value);
  }, []);

  /**
   * Memoized callback for account change
   */
  const handleAccountChange = useCallback((value: string) => {
    setSelectedAccountId(value);
  }, []);

  /**
   * Memoized callback for category change
   */
  const handleCategoryChange = useCallback((value: string) => {
    setSelectedCategoryId(value);
  }, []);

  /**
   * Handle settings button click - opens context menu
   */
  const handleSettingsClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  }, []);

  /**
   * Close context menu
   */
  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  /**
   * Handle menu item click - navigates to page and closes menu
   */
  const handleMenuNavigation = useCallback(
    (path: string) => {
      handleMenuClose();
      void navigate(path);
    },
    [navigate, handleMenuClose],
  );

  /**
   * Handle transaction click - navigate to edit page
   */
  const handleTransactionClick = useCallback(
    (transaction: {id: string}) => {
      void navigate(`/transactions/${transaction.id}/edit?returnTo=${encodeURIComponent('/')}`);
    },
    [navigate],
  );

  // Update refs when handlers change
  useEffect(() => {
    handleNumberRef.current = handleNumber;
    handleOperationRef.current = handleOperation;
    handleEqualsRef.current = handleEquals;
    handleBackspaceRef.current = handleBackspace;
  }, [handleNumber, handleOperation, handleEquals, handleBackspace]);

  // Keyboard shortcuts for calculator
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Don't handle keyboard shortcuts when user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Handle number keys (0-9)
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        handleNumberRef.current?.(event.key);
        return;
      }

      // Handle decimal point
      if (event.key === '.' || event.key === ',') {
        event.preventDefault();
        handleNumberRef.current?.('.');
        return;
      }

      // Handle operations
      if (event.key === '+') {
        event.preventDefault();
        handleOperationRef.current?.('+');
        return;
      }
      if (event.key === '-') {
        event.preventDefault();
        handleOperationRef.current?.('-');
        return;
      }
      if (event.key === '*') {
        event.preventDefault();
        handleOperationRef.current?.('*');
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        handleOperationRef.current?.('/');
        return;
      }

      // Handle equals/Enter
      if (event.key === '=' || event.key === 'Enter') {
        event.preventDefault();
        void handleEqualsRef.current?.();
        return;
      }

      // Handle backspace/Delete
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        handleBackspaceRef.current?.();
        return;
      }

      // Handle Escape to clear
      if (event.key === 'Escape') {
        event.preventDefault();
        setState({
          display: '0',
          previousValue: null,
          operation: null,
          waitingForNewValue: false,
        });
        setShowAmount(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty deps - handlers accessed via refs


  // Transactions are fetched ordered by date descending (newest first) to get the 30 most recent,
  // then reversed for display (oldest first, newest at bottom)

  return (
    <Stack
      direction="column"
      sx={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
      }}
    >
      {error ? (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            zIndex: 1,
            mx: 'auto',
            position: 'sticky',
            top: 0,
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      ) : null}

      {(transactions.length > 0) ? (
        <Box
          ref={historyListRef}
          sx={{
            mb: {xs: 2, sm: 3},
            height: calculatorHeight > 0
              ? {
                  xs: `calc(100vh - ${calculatorHeight}px - 16px)`,
                  sm: `calc(100vh - ${calculatorHeight}px - 24px)`,
                }
              : '100vh',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <HistoryList
            transactions={[...transactions].reverse().map((t) => ({
              ...t,
              date: typeof t.date === 'string' ? new Date(t.date) : t.date,
            }))}
            onTransactionClick={handleTransactionClick}
          />
        </Box>
      ) : null}

      <Box
        ref={calculatorRef}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 10,
          bgcolor: 'background.default',
          px: {xs: 2, sm: 3},
          pb: {xs: 2, sm: 3},
          width: {xs: '100%', sm: '100%'},
          maxWidth: {
            xs: '100%',
            sm: '680px', // Tablet
            md: '800px', // Desktop
          },
          mx: {xs: 0, sm: 'auto'},
        }}
      >
        <Card sx={{p: 2, width: '100%'}}>
          <CalculatorDisplay
            display={state.display}
            previousValue={state.previousValue}
            operation={state.operation}
            waitingForNewValue={state.waitingForNewValue}
            showAmount={showAmount}
            topUsedValues={topUsedValues.map((item) => ({value: Number.parseFloat(item.value), count: item.count}))}
            currency={currency}
            onBackspace={handleBackspace}
            onTopUsedValueClick={handleTopUsedValueClick}
          />

          <Grid container spacing={1} sx={{width: '100%'}}>
            <CalculatorKeypad
              selectedPayeeId={selectedPayeeId}
              selectedAccountId={selectedAccountId}
              selectedCategoryId={selectedCategoryId}
              payees={payees}
              accounts={accounts}
              categories={categories}
              useThousandSeparator={useThousandSeparator}
              creatingTransaction={creatingTransaction}
              canSubmit={!(state.display === '0' && state.previousValue === null)}
              onNumberClick={handleNumber}
              onOperationClick={handleOperation}
              onEqualsClick={handleEquals}
              onPayeeChange={handlePayeeChange}
              onAccountChange={handleAccountChange}
              onCategoryChange={handleCategoryChange}
              onSettingsClick={handleSettingsClick}
            />
            <CalculatorControls
              menuAnchor={menuAnchor}
              onMenuClose={handleMenuClose}
              onMenuNavigation={handleMenuNavigation}
            />
          </Grid>
        </Card>
      </Box>

    </Stack>
  );
}


