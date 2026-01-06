/**
 * Transaction Edit Dialog Component
 * Dialog for editing transaction details
 */

import React, {useState, useEffect} from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import {Dialog} from './ui/Dialog';
import {Button} from './ui/Button';
import {UPDATE_TRANSACTION} from '../graphql/mutations';
import {GET_CATEGORIES, GET_PAYEES, GET_TRANSACTIONS, GET_RECENT_TRANSACTIONS} from '../graphql/queries';
import {useAccounts} from '../hooks/useAccounts';
import type {Transaction} from '../hooks/useTransactions';

/**
 * Transaction edit dialog props
 */
interface TransactionEditDialogProps {
  open: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Transaction Edit Dialog Component
 */
export function TransactionEditDialog({
  open,
  transaction,
  onClose,
  onSuccess,
}: TransactionEditDialogProps): React.JSX.Element {
  const {accounts} = useAccounts();
  const {data: categoriesData} = useQuery<{categories?: Array<{id: string; name: string}>}>(
    GET_CATEGORIES,
  );
  const {data: payeesData} = useQuery<{payees?: Array<{id: string; name: string}>}>(
    GET_PAYEES,
  );

  const categories = categoriesData?.categories ?? [];
  const payees = payeesData?.payees ?? [];

  const [value, setValue] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [payeeId, setPayeeId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Initialize form when transaction changes
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

  const [updateTransaction, {loading}] = useMutation(UPDATE_TRANSACTION, {
    refetchQueries: [{query: GET_TRANSACTIONS}, {query: GET_RECENT_TRANSACTIONS}],
    awaitRefetchQueries: true,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      onSuccess();
      onClose();
    },
  });

  /**
   * Handle form submission
   */
  const handleSubmit = (): void => {
    if (!transaction) {
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
      const transactionDate = typeof transaction.date === 'string'
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
        id: transaction.id,
        input: updateInput,
      },
    });
  };

  const actions = (
    <Box sx={{display: 'flex', gap: 1, justifyContent: 'flex-end'}}>
      <Button onClick={onClose} disabled={loading}>
        Cancel
      </Button>
      <Button variant="contained" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Saving...' : 'Save'}
      </Button>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} title="Edit Transaction" actions={actions}>
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
      </Box>
    </Dialog>
  );
}

