/**
 * Transaction Edit Page
 * Page for editing transaction details
 */

import React, {useState, useEffect} from 'react';
import {useParams, useNavigate, useSearchParams} from 'react-router';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Button,
} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {UPDATE_TRANSACTION} from '../graphql/mutations';
import {GET_TRANSACTION, GET_CATEGORIES, GET_PAYEES} from '../graphql/queries';
import {useAccounts} from '../hooks/useAccounts';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {useTitle} from '../contexts/TitleContext';
import type {Transaction} from '../hooks/useTransactions';

/**
 * Transaction data from GraphQL query
 */
interface TransactionData {
  transaction?: Transaction | null;
}

/**
 * Transaction Edit Page Component
 */
export function TransactionEditPage(): React.JSX.Element {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';
  const {setTitle} = useTitle();

  const {accounts} = useAccounts();
  const {data: categoriesData} = useQuery<{categories?: Array<{id: string; name: string}>}>(
    GET_CATEGORIES,
  );
  const {data: payeesData} = useQuery<{payees?: Array<{id: string; name: string}>}>(
    GET_PAYEES,
  );
  const {data: transactionData, loading: transactionLoading, error: transactionError} = useQuery<TransactionData>(
    GET_TRANSACTION,
    {
      variables: {id},
      skip: !id,
      errorPolicy: 'all',
    },
  );

  const categories = categoriesData?.categories ?? [];
  const payees = payeesData?.payees ?? [];
  const transaction = transactionData?.transaction;

  const [value, setValue] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [payeeId, setPayeeId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Set appbar title
  useEffect(() => {
    setTitle('Edit Transaction');
    // Cleanup: clear title when component unmounts
    return () => {
      setTitle(undefined);
    };
  }, [setTitle]);

  // Initialize form when transaction is loaded
  useEffect(() => {
    if (transaction) {
      setValue(String(transaction.value ?? ''));
      const dateValue =
        typeof transaction.date === 'string'
          ? transaction.date.split('T')[0] ?? ''
          : new Date(transaction.date).toISOString().split('T')[0] ?? '';
      setDate(dateValue);
      setAccountId(transaction.account?.id ?? '');
      setCategoryId(transaction.category?.id ?? '');
      setPayeeId(transaction.payee?.id ?? '');
      setNote(transaction.note ?? '');
      setError(null);
    }
  }, [transaction]);

  /**
   * Validate return URL to prevent open redirects
   * Only allow relative paths starting with /
   */
  const getValidReturnUrl = (url: string): string => {
    // Only allow relative paths starting with /
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    return '/';
  };

  const [updateTransaction, {loading}] = useMutation(UPDATE_TRANSACTION, {
    refetchQueries: ['GetTransactions', 'GetRecentTransactions', 'GetAccount'],
    awaitRefetchQueries: true,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      // Navigate back to return URL
      const validReturnUrl = getValidReturnUrl(returnTo);
      void navigate(validReturnUrl);
    },
  });

  /**
   * Handle form submission
   */
  const handleSubmit = (): void => {
    if (!transaction || !id) {
      return;
    }

    setError(null);

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setError('Value must be a valid number');
      return;
    }

    const updateInput: {
      value?: number;
      date?: string;
      accountId?: string;
      categoryId?: string | null;
      payeeId?: string | null;
      note?: string | null;
    } = {};

    if (value !== String(transaction.value ?? '')) {
      updateInput.value = numValue;
    }
    if (date) {
      const transactionDate =
        typeof transaction.date === 'string'
          ? transaction.date.split('T')[0]
          : new Date(transaction.date).toISOString().split('T')[0];
      if (date !== transactionDate) {
        updateInput.date = new Date(date).toISOString();
      }
    }
    if (accountId && accountId !== transaction.account?.id) {
      updateInput.accountId = accountId;
    }
    if (categoryId !== (transaction.category?.id ?? '')) {
      updateInput.categoryId = categoryId || null;
    }
    if (payeeId !== (transaction.payee?.id ?? '')) {
      updateInput.payeeId = payeeId || null;
    }
    if (note !== (transaction.note ?? '')) {
      updateInput.note = note || null;
    }

    void updateTransaction({
      variables: {
        id,
        input: updateInput,
      },
    });
  };


  // Show loading state
  if (transactionLoading) {
    return <LoadingSpinner message="Loading transaction..." />;
  }

  // Show error state
  if (transactionError) {
    return (
      <ErrorAlert
        title="Error Loading Transaction"
        message={transactionError?.message ?? 'Error loading transaction details'}
      />
    );
  }

  // Show not found state
  if (!transaction) {
    return (
      <ErrorAlert
        title="Transaction Not Found"
        message="The requested transaction could not be found."
        severity="warning"
      />
    );
  }

  return (
    <Box sx={{width: '100%', maxWidth: 600, mx: 'auto'}}>
      <Card sx={{p: 3}}>
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          <TextField
            label="Value"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            fullWidth
            required
            inputProps={{step: '0.01'}}
          />

          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            required
            InputLabelProps={{shrink: true}}
          />

          <FormControl fullWidth>
            <InputLabel>Account</InputLabel>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} label="Account">
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              label="Category"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Payee</InputLabel>
            <Select value={payeeId} onChange={(e) => setPayeeId(e.target.value)} label="Payee">
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {payees.map((payee) => (
                <MenuItem key={payee.id} value={payee.id}>
                  {payee.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />

          <Box sx={{display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2}}>
            <Button
              onClick={() => {
                const validReturnUrl = getValidReturnUrl(returnTo);
                void navigate(validReturnUrl);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}

