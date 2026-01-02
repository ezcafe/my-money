/**
 * Payee Edit Dialog Component
 * Dialog for creating/editing payees
 */

import React, {useState, useEffect} from 'react';
import {Box, Typography} from '@mui/material';
import {useMutation} from '@apollo/client/react';
import {Dialog} from './ui/Dialog';
import {Button} from './ui/Button';
import {TextField} from './ui/TextField';
import {CREATE_PAYEE, UPDATE_PAYEE} from '../graphql/mutations';
import type {Payee} from '../hooks/usePayees';

/**
 * Payee edit dialog props
 */
interface PayeeEditDialogProps {
  open: boolean;
  payee: Payee | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Payee Edit Dialog Component
 */
export function PayeeEditDialog({
  open,
  payee,
  onClose,
  onSuccess,
}: PayeeEditDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [createPayee, {loading: creating}] = useMutation(CREATE_PAYEE, {
    refetchQueries: ['GetPayees'],
    awaitRefetchQueries: true,
    onCompleted: () => {
      onSuccess();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const [updatePayee, {loading: updating}] = useMutation(UPDATE_PAYEE, {
    refetchQueries: ['GetPayees', 'GetPayee'],
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

  // Initialize form when payee changes
  useEffect(() => {
    if (payee) {
      setName(payee.name);
    } else {
      setName('');
    }
    setError(null);
  }, [payee, open]);

  /**
   * Handle save
   */
  const handleSave = (): void => {
    setError(null);

    if (payee) {
      // Update existing payee
      void updatePayee({
        variables: {
          id: payee.id,
          input: {
            name,
          },
        },
      });
    } else {
      // Create new payee
      void createPayee({
        variables: {
          input: {
            name,
          },
        },
      });
    }
  };

  const actions = (
    <Box sx={{display: 'flex', gap: 1, justifyContent: 'flex-end'}}>
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
      title={payee ? 'Edit Payee' : 'Create Payee'}
      actions={actions}
    >
      <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
        {error && (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        )}

        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          required
        />
      </Box>
    </Dialog>
  );
}

