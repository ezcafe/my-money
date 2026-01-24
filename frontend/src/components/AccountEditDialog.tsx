/**
 * Account Edit Dialog Component
 * Dialog for creating/editing accounts
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useMutation } from '@apollo/client/react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { TextField } from './ui/TextField';
import { CREATE_ACCOUNT, UPDATE_ACCOUNT } from '../graphql/mutations';
import { GET_ACCOUNTS, GET_ACCOUNT } from '../graphql/queries';
import type { Account } from '../hooks/useAccounts';

type AccountType = 'Cash' | 'CreditCard' | 'Bank' | 'Saving' | 'Loans';

const ACCOUNT_TYPES: Array<{ value: AccountType; label: string }> = [
  { value: 'Cash', label: 'Cash' },
  { value: 'CreditCard', label: 'Credit Card' },
  { value: 'Bank', label: 'Bank' },
  { value: 'Saving', label: 'Saving' },
  { value: 'Loans', label: 'Loans' },
];

/**
 * Account edit dialog props
 */
interface AccountEditDialogProps {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Account Edit Dialog Component
 */
export function AccountEditDialog({
  open,
  account,
  onClose,
  onSuccess,
}: AccountEditDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [initBalance, setInitBalance] = useState('0');
  const [accountType, setAccountType] = useState<AccountType>('Cash');
  const [error, setError] = useState<string | null>(null);

  const [createAccount, { loading: creating }] = useMutation(CREATE_ACCOUNT, {
    refetchQueries: [{ query: GET_ACCOUNTS }],
    awaitRefetchQueries: true,
    onCompleted: () => {
      onSuccess();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const [updateAccount, { loading: updating }] = useMutation(UPDATE_ACCOUNT, {
    refetchQueries: account
      ? [{ query: GET_ACCOUNTS }, { query: GET_ACCOUNT, variables: { id: account.id } }]
      : [{ query: GET_ACCOUNTS }],
    awaitRefetchQueries: true,
    onCompleted: () => {
      onSuccess();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const loading = creating || updating;

  // Initialize form when account changes
  useEffect(() => {
    if (account) {
      setName(account.name);
      setInitBalance(String(account.initBalance));
      setAccountType(account.accountType);
    } else {
      setName('');
      setInitBalance('');
      setAccountType('Cash');
    }
    setError(null);
  }, [account, open]);

  /**
   * Handle save
   */
  const handleSave = (): void => {
    setError(null);

    // Handle optional initBalance - default to 0 if empty or invalid
    let balance: number | undefined = undefined;
    if (initBalance && initBalance.trim() !== '') {
      const parsed = parseFloat(initBalance);
      if (isNaN(parsed)) {
        setError('Initial balance must be a valid number');
        return;
      }
      balance = parsed;
    }

    if (account) {
      // Update existing account
      void updateAccount({
        variables: {
          id: account.id,
          input: {
            name,
            ...(balance !== undefined ? { initBalance: balance } : {}),
            accountType,
          },
        },
      });
    } else {
      // Create new account
      void createAccount({
        variables: {
          input: {
            name,
            ...(balance !== undefined ? { initBalance: balance } : {}),
            accountType,
          },
        },
      });
    }
  };

  const actions = (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
      <Button onClick={onClose} disabled={loading} variant="outlined">
        Cancel
      </Button>
      <Button onClick={handleSave} disabled={loading || !name.trim()}>
        {loading ? 'Saving...' : 'Save'}
      </Button>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={account ? 'Edit Account' : 'Create Account'}
      actions={actions}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : null}

        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          required
        />

        <TextField
          label="Initial Balance"
          type="number"
          value={initBalance}
          onChange={(e) => setInitBalance(e.target.value)}
          fullWidth
          required={false}
          inputProps={{ step: '0.01' }}
        />

        <FormControl fullWidth>
          <InputLabel>Account Type</InputLabel>
          <Select
            value={accountType}
            label="Account Type"
            onChange={(e) => setAccountType(e.target.value as AccountType)}
          >
            {ACCOUNT_TYPES.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                {type.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Dialog>
  );
}
