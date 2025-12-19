/**
 * Calculator Component
 * Modern calculator UI with history list and operations
 */

import React, {useState, useCallback} from 'react';
import {Box, Grid, Paper, Typography, Alert, Select, MenuItem, FormControl, InputLabel} from '@mui/material';
import {useMutation} from '@apollo/client';
import {useNavigate} from 'react-router';
import {Button} from './ui/Button';
import {TextField} from './ui/TextField';
import {Card} from './ui/Card';
import {HistoryList} from './HistoryList';
import {Settings as SettingsIcon} from '@mui/icons-material';
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
export function Calculator(): JSX.Element {
  const navigate = useNavigate();
  const {accounts} = useAccounts();
  const {transactions} = useRecentTransactions(MAX_RECENT_TRANSACTIONS);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
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

  // Set default account if available
  React.useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      const defaultAccount = accounts.find((acc) => acc.isDefault) ?? accounts[0];
      if (defaultAccount) {
        setSelectedAccountId(defaultAccount.id);
      }
    }
  }, [accounts, selectedAccountId]);

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

  const handleClear = useCallback(() => {
    setState({
      display: '0',
      previousValue: null,
      operation: null,
      waitingForNewValue: false,
    });
  }, []);

  const handleEquals = useCallback(() => {
    handleOperation('=');
  }, [handleOperation]);

  const handleAdd = useCallback(async (): Promise<void> => {
    if (!selectedAccountId) {
      setError('Please select an account');
      return;
    }

    const result = parseFloat(state.display);
    if (isNaN(result)) {
      setError('Invalid calculation result');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await createTransaction({
        variables: {
          input: {
            value: result,
            accountId: selectedAccountId,
            date: new Date().toISOString(),
          },
        },
      });

      // Reset calculator after successful transaction
      setState({
        display: '0',
        previousValue: null,
        operation: null,
        waitingForNewValue: false,
      });
    } catch {
      // Error handled by onError callback
    }
  }, [state.display, selectedAccountId, createTransaction]);

  const handleSettings = useCallback(() => {
    void navigate('/preferences');
  }, [navigate]);

  return (
    <Box sx={{p: 2, maxWidth: 400, mx: 'auto'}}>
      {error && (
        <Alert severity="error" sx={{mb: 2}} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{p: 2, mb: 2}}>
        <Typography variant="h6" gutterBottom>
          History
        </Typography>
        <HistoryList transactions={transactions} />
      </Card>

      <Card sx={{p: 2, mb: 2}}>
        <FormControl fullWidth>
          <InputLabel>Account</InputLabel>
          <Select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            label="Account"
          >
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Card>

      <Paper sx={{p: 2}}>
        <TextField
          fullWidth
          value={state.display}
          inputProps={{readOnly: true, style: {textAlign: 'right', fontSize: '2rem'}}}
          sx={{mb: 2}}
        />

        <Grid container spacing={1}>
          {/* Number pad */}
          {[7, 8, 9, 4, 5, 6, 1, 2, 3, 0].map((num) => (
            <Grid item xs={4} key={num}>
              <Button fullWidth variant="contained" onClick={() => handleNumber(String(num))}>
                {num}
              </Button>
            </Grid>
          ))}

          {/* 000 button */}
          <Grid item xs={4}>
            <Button fullWidth variant="contained" onClick={() => handleNumber('000')}>
              000
            </Button>
          </Grid>

          {/* Operations */}
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('+')}>
              +
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('-')}>
              -
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('*')}>
              *
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('/')}>
              /
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={() => handleOperation('%')}>
              %
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={handleEquals}>
              =
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={handleClear}>
              Clear
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={() => {
                void handleAdd();
              }}
              disabled={Boolean(creatingTransaction) || !selectedAccountId}
            >
              {creatingTransaction ? 'Adding...' : 'Add'}
            </Button>
          </Grid>
          <Grid item xs={3}>
            <Button fullWidth variant="outlined" onClick={handleSettings} aria-label="Settings">
              <SettingsIcon />
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}


