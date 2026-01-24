/**
 * Calculator Component
 * Modern calculator UI with history list and operations
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Box, Alert, Stack } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { useQuery } from '@apollo/client/react';
import { useNavigate, useLocation } from 'react-router';
import { HistoryList } from './HistoryList';
import { GET_PREFERENCES } from '../graphql/queries';
import { useRecentTransactions } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { usePayees } from '../hooks/usePayees';
import { useTopUsedValues } from '../hooks/useTopUsedValues';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useCalculatorState } from '../hooks/useCalculatorState';
import { useCalculatorTransaction } from '../hooks/useCalculatorTransaction';
import { useCalculatorKeyboard } from '../hooks/useCalculatorKeyboard';
import { MAX_RECENT_TRANSACTIONS } from '../constants';
import { CalculatorDisplay } from './calculator/CalculatorDisplay';
import { CalculatorKeypad } from './calculator/CalculatorKeypad';
import { CalculatorControls } from './calculator/CalculatorControls';
import { Card } from './ui/Card';

/**
 * Calculator component
 */
export function Calculator(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const prevLocationRef = useRef<string>(location.pathname);
  // Order by desc to get newest transactions first, then reverse for display (oldest first, newest at bottom)
  const {
    transactions,
    loading: transactionsLoading,
    refetch: refetchRecentTransactions,
  } = useRecentTransactions(MAX_RECENT_TRANSACTIONS, { field: 'date', direction: 'desc' });
  const { topUsedValues } = useTopUsedValues(90);
  const { data: preferencesData } = useQuery<{
    preferences?: { currency: string; useThousandSeparator: boolean };
  }>(GET_PREFERENCES);
  const currency = preferencesData?.preferences?.currency ?? 'USD';
  const useThousandSeparator = preferencesData?.preferences?.useThousandSeparator ?? true;

  // Calculator state management
  const {
    state,
    showAmount,
    handleNumber,
    handleOperation,
    handleBackspace,
    handleTopUsedValueClick,
    handleEquals: calculateResult,
    reset,
  } = useCalculatorState();

  // Calculate current amount from display for auto-selection
  const currentAmount = useMemo(() => {
    if (!showAmount || state.display === '0') {
      return null;
    }
    const parsed = parseFloat(state.display);
    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
  }, [showAmount, state.display]);

  // Transaction creation and selection management
  const {
    selectedAccountId,
    selectedCategoryId,
    selectedPayeeId,
    setSelectedAccountId,
    setSelectedCategoryId,
    setSelectedPayeeId,
    createTransaction,
    creating: creatingTransaction,
    error: transactionError,
  } = useCalculatorTransaction(currentAmount, () => {
    reset();
    void refetchRecentTransactions();
  });

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const historyListRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<HTMLDivElement>(null);
  const [calculatorHeight, setCalculatorHeight] = useState<number>(0);

  // Auto-scroll to bottom when transactions are loaded or new ones are added
  useAutoScroll(historyListRef, transactions, transactionsLoading);

  // Get accounts, categories, payees for keypad
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { payees } = usePayees();

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
    if (
      prevLocationRef.current !== location.pathname &&
      prevLocationRef.current.includes('/transactions/')
    ) {
      void refetchRecentTransactions();
    }
    prevLocationRef.current = location.pathname;
  }, [location.pathname, refetchRecentTransactions]);

  /**
   * Handle equals - calculate result and create transaction
   */
  const handleEquals = useCallback(async () => {
    const result = calculateResult();
    if (result === null || Number.isNaN(result) || !Number.isFinite(result)) {
      return;
    }

    try {
      await createTransaction(result);
    } catch {
      // Error handled by useCalculatorTransaction hook
    }
  }, [calculateResult, createTransaction]);

  /**
   * Memoized callback for payee change
   */
  const handlePayeeChange = useCallback(
    (value: string) => {
      setSelectedPayeeId(value);
    },
    [setSelectedPayeeId]
  );

  /**
   * Memoized callback for account change
   */
  const handleAccountChange = useCallback(
    (value: string) => {
      setSelectedAccountId(value);
    },
    [setSelectedAccountId]
  );

  /**
   * Memoized callback for category change
   */
  const handleCategoryChange = useCallback(
    (value: string) => {
      setSelectedCategoryId(value);
    },
    [setSelectedCategoryId]
  );

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
    [navigate, handleMenuClose]
  );

  /**
   * Handle transaction click - navigate to edit page
   */
  const handleTransactionClick = useCallback(
    (transaction: { id: string }) => {
      void navigate(`/transactions/${transaction.id}/edit?returnTo=${encodeURIComponent('/')}`);
    },
    [navigate]
  );

  // Keyboard shortcuts for calculator
  useCalculatorKeyboard({
    handleNumber,
    handleOperation,
    handleEquals,
    handleBackspace,
    handleClear: reset,
  });

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
      {transactionError ? (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            zIndex: 1,
            mx: 'auto',
            position: 'sticky',
            top: 0,
          }}
          onClose={() => {
            // Error is managed by useCalculatorTransaction hook
          }}
        >
          {transactionError}
        </Alert>
      ) : null}

      {transactions.length > 0 ? (
        <Box
          ref={historyListRef}
          sx={{
            mb: { xs: 2, sm: 3 },
            height:
              calculatorHeight > 0
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
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 3 },
          width: { xs: '100%', sm: '100%' },
          maxWidth: {
            xs: '100%',
            sm: '680px', // Tablet
            md: '800px', // Desktop
          },
          mx: { xs: 0, sm: 'auto' },
        }}
      >
        <Card sx={{ p: 2, width: '100%' }}>
          <CalculatorDisplay
            display={state.display}
            previousValue={state.previousValue}
            operation={state.operation}
            waitingForNewValue={state.waitingForNewValue}
            showAmount={showAmount}
            topUsedValues={topUsedValues.map((item) => ({
              value: Number.parseFloat(item.value),
              count: item.count,
            }))}
            currency={currency}
            onBackspace={handleBackspace}
            onTopUsedValueClick={handleTopUsedValueClick}
          />

          <Grid container spacing={1} sx={{ width: '100%' }}>
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
