/**
 * Calculator Component
 * Modern calculator UI with history list and operations
 */

import React, {useState, useCallback, useMemo} from 'react';
import {Box, Grid, Paper, Typography, Alert} from '@mui/material';
import {useMutation} from '@apollo/client/react';
import {useNavigate} from 'react-router';
import {Button} from './ui/Button';
import {HistoryList} from './HistoryList';
import {MoreHorizOutlined as MoreIcon, ArrowForward as GoIcon} from '@mui/icons-material';
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
  const {transactions} = useRecentTransactions(MAX_RECENT_TRANSACTIONS);
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
  }, [defaultAccountId, createTransaction]);

  const handleSettings = useCallback(() => {
    void navigate('/preferences');
  }, [navigate]);

  return (
    <Box
      sx={{
        p: 2,
        maxWidth: 400,
        mx: 'auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {error && (
        <Alert severity="error" sx={{mb: 2}} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          mb: 2,
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

      <Paper sx={{p: 2, backgroundColor: 'transparent', boxShadow: 'none', flexShrink: 0}}>
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

          {/* Row 5: Preferences, 0, 000, = */}
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={handleSettings} aria-label="Preferences">
              <MoreIcon />
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('0')}>
              0
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('000')}>
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
            >
              {creatingTransaction ? 'Adding...' : <GoIcon />}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}


