/**
 * Calculator Component
 * Modern calculator UI with history list and operations
 */

import React, {useState, useCallback, useMemo, useRef, useEffect} from 'react';
import {Box, Grid, Paper, Typography, Alert, Menu, MenuItem, ListItemIcon, ListItemText, Chip} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import {useNavigate, useLocation} from 'react-router';
import {Button} from './ui/Button';
import {HistoryList} from './HistoryList';
import {
  MoreHorizOutlined as MoreIcon,
  ArrowForward as GoIcon,
  Assessment,
  Upload,
  Settings,
} from '@mui/icons-material';
import {PlusMinusIcon} from './calculator/PlusMinusIcon';
import {CREATE_TRANSACTION} from '../graphql/mutations';
import {GET_PREFERENCES} from '../graphql/queries';
import {useRecentTransactions} from '../hooks/useTransactions';
import {useAccounts} from '../hooks/useAccounts';
import {useCategories} from '../hooks/useCategories';
import {useTopUsedValues} from '../hooks/useTopUsedValues';
import {useAutoScroll} from '../hooks/useAutoScroll';
import {formatCurrencyPreserveDecimals} from '../utils/formatting';
import {MAX_RECENT_TRANSACTIONS} from '../utils/constants';

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
    // Use query name string for more reliable cache matching
    refetchQueries: ['GetRecentTransactions'],
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

  // Auto-scroll to bottom when transactions are loaded or new ones are added
  useAutoScroll(historyListRef, transactions, transactionsLoading);

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

  // Get default category ID
  const defaultCategoryId = useMemo(() => {
    const defaultCategory = categories.find(
      (cat) => cat.name === 'Default Category' && cat.type === 'EXPENSE',
    );
    return defaultCategory?.id ?? null;
  }, [categories]);

  const handleNumber = useCallback((num: string) => {
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
          case '%':
            result = prev.previousValue % currentValue;
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

  const handlePlusMinus = useCallback(() => {
    setState((prev) => {
      const currentValue = parseFloat(prev.display);
      if (isNaN(currentValue)) {
        return prev;
      }
      return {
        ...prev,
        display: String(-currentValue),
      };
    });
  }, []);

  /**
   * Handle top used value button click
   * Sets the calculator display to the selected value
   */
  const handleTopUsedValueClick = useCallback((value: number) => {
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
          case '%':
            result = prev.previousValue % currentValue;
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
      createTransaction({
        variables: {
          input: {
            value: result,
            accountId: defaultAccountId,
            categoryId: defaultCategoryId,
            date: new Date().toISOString(),
          },
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
  }, [defaultAccountId, defaultCategoryId, createTransaction]);

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

  const menuItems = [
    {path: '/report', label: 'Report', icon: <Assessment />},
    {path: '/import', label: 'Import Statement', icon: <Upload />},
    {path: '/preferences', label: 'Preferences', icon: <Settings />},
  ];

  // Transactions are fetched ordered by date descending (newest first) to get the 30 most recent,
  // then reversed for display (oldest first, newest at bottom)

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        position: 'relative',
      }}
    >
      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            position: 'sticky',
            top: 0,
            zIndex: 1,
            maxWidth: 400,
            mx: 'auto',
            px: 2,
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <Box
        ref={historyListRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%',
          maxWidth: '100vw',
          // Padding at bottom to prevent content from being hidden behind fixed calculator
          pb: '340px',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'action.disabled',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: 'action.disabledBackground',
            },
          },
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

      <Box
        sx={{
          maxWidth: 400,
          mx: 'auto',
          width: '100%',
        }}
      >
        <Paper
          sx={{
            p: 2,
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 400,
            zIndex: 10,
            backgroundColor: 'background.paper',
          }}
        >
        <Typography
          variant="h4"
          sx={{
            textAlign: 'right',
            fontSize: '2rem',
            mb: 2,
            minHeight: '3rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          {state.previousValue !== null && state.operation
            ? `${state.previousValue} ${state.operation} ${state.waitingForNewValue ? '' : state.display}`
            : state.display}
        </Typography>

        {/* Top 5 Most Used Values Row */}
        {topUsedValues.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              mb: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'thin',
              '&::-webkit-scrollbar': {
                height: '6px',
              },
              '&::-webkit-scrollbar-track': {
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'action.disabled',
                borderRadius: '3px',
                '&:hover': {
                  backgroundColor: 'action.disabledBackground',
                },
              },
            }}
          >
            {topUsedValues.slice(0, 5).map((item, index) => (
              <Chip
                key={`${item.value}-${index}`}
                label={formatCurrencyPreserveDecimals(item.value, currency)}
                variant="outlined"
                onClick={() => handleTopUsedValueClick(Number(item.value))}
                sx={{cursor: 'pointer'}}
              />
            ))}
          </Box>
        )}

        <Grid container spacing={1}>
          {/* Row 1: Backspace, ±, %, ÷ */}
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={handleBackspace}>
              «
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={handlePlusMinus}>
              <PlusMinusIcon />
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('%')}>
              %
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('/')}>
              ÷
            </Button>
          </Grid>

          {/* Row 2: 7, 8, 9, × */}
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('7')}>
              7
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('8')}>
              8
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('9')}>
              9
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('*')}>
              ×
            </Button>
          </Grid>

          {/* Row 3: 4, 5, 6, − */}
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('4')}>
              4
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('5')}>
              5
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('6')}>
              6
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('-')}>
              −
            </Button>
          </Grid>

          {/* Row 4: 1, 2, 3, + */}
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('1')}>
              1
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('2')}>
              2
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('3')}>
              3
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('+')}>
              +
            </Button>
          </Grid>

          {/* Row 5: Settings, 0, 000/., = */}
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={handleSettingsClick} aria-label="Preferences">
              <MoreIcon />
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('0')}>
              0
            </Button>
          </Grid>
          <Grid item xs={3}>
            {useThousandSeparator ? (
              <Button fullWidth variant="contained" onClick={() => handleNumber('000')}>
                000
              </Button>
            ) : (
              <Button fullWidth variant="contained" onClick={() => handleNumber('.')}>
                .
              </Button>
            )}
          </Grid>
          <Grid item xs={3}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={() => {
                void handleEquals();
              }}
              disabled={
                Boolean(creatingTransaction) ||
                (state.display === '0' && state.previousValue === null)
              }
            >
              {creatingTransaction ? '...' : <GoIcon />}
            </Button>
          </Grid>
        </Grid>
        </Paper>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        {menuItems.map((item) => (
          <MenuItem
            key={item.path}
            onClick={() => {
              handleMenuNavigation(item.path);
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}


