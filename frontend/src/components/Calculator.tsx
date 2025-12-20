/**
 * Calculator Component
 * Modern calculator UI with history list and operations
 */

import React, {useState, useCallback, useMemo, useEffect, useRef} from 'react';
import {Box, Grid, Paper, Typography, Alert, Menu, MenuItem, ListItemIcon, ListItemText} from '@mui/material';
import {useMutation} from '@apollo/client/react';
import {useNavigate} from 'react-router';
import {Button} from './ui/Button';
import {HistoryList} from './HistoryList';
import {
  MoreHorizOutlined as MoreIcon,
  ArrowForward as GoIcon,
  AccountBalance,
  Assessment,
  Schedule,
  Upload,
  Settings,
} from '@mui/icons-material';
import {PlusMinusIcon} from './calculator/PlusMinusIcon';
import {CREATE_TRANSACTION} from '../graphql/mutations';
import {GET_RECENT_TRANSACTIONS, GET_ACCOUNTS} from '../graphql/queries';
import {useRecentTransactions} from '../hooks/useTransactions';
import {useAccounts} from '../hooks/useAccounts';
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
  const {accounts} = useAccounts();
  const {transactions, loading: transactionsLoading} = useRecentTransactions(MAX_RECENT_TRANSACTIONS);
  const hasScrolledOnLoad = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const [createTransaction, {loading: creatingTransaction}] = useMutation(CREATE_TRANSACTION, {
    refetchQueries: [GET_RECENT_TRANSACTIONS, GET_ACCOUNTS],
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
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
  const previousTransactionsLength = useRef(0);

  // Get default account ID
  const defaultAccountId = useMemo(() => {
    if (accounts.length === 0) {
      return null;
    }
    const defaultAccount = accounts.find((acc) => acc.isDefault) ?? accounts[0];
    return defaultAccount?.id ?? null;
  }, [accounts]);

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
   * Scroll history list to bottom with smooth animation
   * @param smooth - Whether to use smooth scrolling animation (default: true)
   */
  const scrollToBottom = useCallback((smooth = true) => {
    if (historyListRef.current) {
      historyListRef.current.scrollTo({
        top: historyListRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant',
      });
    }
  }, []);

  const handleEquals = useCallback(async () => {
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
  }, [defaultAccountId, createTransaction, scrollToBottom]);

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

  const menuItems = [
    {path: '/accounts', label: 'Accounts', icon: <AccountBalance />},
    {path: '/report', label: 'Report', icon: <Assessment />},
    {path: '/schedule', label: 'Schedule', icon: <Schedule />},
    {path: '/import', label: 'Import', icon: <Upload />},
    {path: '/preferences', label: 'Settings', icon: <Settings />},
  ];

  // Transactions are already sorted by date ascending (oldest first, latest at bottom) from backend

  /**
   * Scroll to bottom on initial load when data is ready
   * Uses smooth animation for a polished user experience
   */
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    if (!transactionsLoading && transactions.length > 0 && !hasScrolledOnLoad.current) {
      // Mark that we've done the initial scroll
      hasScrolledOnLoad.current = true;
      // Use setTimeout to ensure DOM layout is complete after React render
      // 300ms delay ensures content is fully rendered before scrolling
      timeoutId = setTimeout(() => {
        if (historyListRef.current) {
          const element = historyListRef.current;
          element.scrollTo({
            top: element.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 300);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [transactionsLoading, transactions.length]);

  /**
   * Auto-scroll to bottom when a new transaction is added
   * Detects when transaction count increases and scrolls smoothly
   */
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    // Skip if still loading or if this is the initial load
    if (transactionsLoading || !hasScrolledOnLoad.current) {
      previousTransactionsLength.current = transactions.length;
      return;
    }

    // If transaction count increased, scroll to bottom
    if (transactions.length > previousTransactionsLength.current) {
      timeoutId = setTimeout(() => {
        if (historyListRef.current) {
          const element = historyListRef.current;
          element.scrollTo({
            top: element.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 300);
      
      previousTransactionsLength.current = transactions.length;
    } else {
      previousTransactionsLength.current = transactions.length;
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [transactions.length, transactionsLoading]);

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
            backgroundColor: 'transparent',
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
          transactions={transactions.map((t) => ({
            ...t,
            date: typeof t.date === 'string' ? new Date(t.date) : t.date,
          }))}
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
            backgroundColor: 'background.default',
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

        <Grid container spacing={1}>
          {/* Row 1: Backspace, ±, %, ÷ */}
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={handleBackspace} sx={{ boxShadow: 'none' }}>
              «
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={handlePlusMinus} sx={{ boxShadow: 'none' }}>
              <PlusMinusIcon />
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('%')} sx={{ boxShadow: 'none' }}>
              %
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('/')} sx={{ boxShadow: 'none' }}>
              ÷
            </Button>
          </Grid>

          {/* Row 2: 7, 8, 9, × */}
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('7')} sx={{ boxShadow: 'none' }}>
              7
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('8')} sx={{ boxShadow: 'none' }}>
              8
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('9')} sx={{ boxShadow: 'none' }}>
              9
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('*')} sx={{ boxShadow: 'none' }}>
              ×
            </Button>
          </Grid>

          {/* Row 3: 4, 5, 6, − */}
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('4')} sx={{ boxShadow: 'none' }}>
              4
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('5')} sx={{ boxShadow: 'none' }}>
              5
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('6')} sx={{ boxShadow: 'none' }}>
              6
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('-')} sx={{ boxShadow: 'none' }}>
              −
            </Button>
          </Grid>

          {/* Row 4: 1, 2, 3, + */}
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('1')} sx={{ boxShadow: 'none' }}>
              1
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('2')} sx={{ boxShadow: 'none' }}>
              2
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('3')} sx={{ boxShadow: 'none' }}>
              3
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('+')} sx={{ boxShadow: 'none' }}>
              +
            </Button>
          </Grid>

          {/* Row 5: Settings, 0, 000, = */}
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={handleSettingsClick} aria-label="Settings" sx={{ boxShadow: 'none' }}>
              <MoreIcon />
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('0')} sx={{ boxShadow: 'none' }}>
              0
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('000')} sx={{ boxShadow: 'none' }}>
              000
            </Button>
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
              sx={{ boxShadow: 'none' }}
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
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            minWidth: 200,
          },
        }}
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


