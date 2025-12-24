/**
 * Category Edit Dialog Component
 * Dialog for creating/editing categories
 */

import React, {useState, useEffect} from 'react';
import {Box, Typography, ToggleButtonGroup, ToggleButton} from '@mui/material';
import {useMutation} from '@apollo/client/react';
import {Dialog} from './ui/Dialog';
import {Button} from './ui/Button';
import {TextField} from './ui/TextField';
import {CREATE_CATEGORY, UPDATE_CATEGORY} from '../graphql/mutations';
import type {Category} from '../hooks/useCategories';

/**
 * Category edit dialog props
 */
interface CategoryEditDialogProps {
  open: boolean;
  category: Category | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Category Edit Dialog Component
 */
export function CategoryEditDialog({
  open,
  category,
  onClose,
  onSuccess,
}: CategoryEditDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [categoryType, setCategoryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [error, setError] = useState<string | null>(null);

  const [createCategory, {loading: creating}] = useMutation(CREATE_CATEGORY, {
    refetchQueries: ['GetCategories'],
    awaitRefetchQueries: true,
    onCompleted: () => {
      onSuccess();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const [updateCategory, {loading: updating}] = useMutation(UPDATE_CATEGORY, {
    refetchQueries: ['GetCategories', 'GetCategory'],
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

  // Initialize form when category changes
  useEffect(() => {
    if (category) {
      setName(category.name);
      setCategoryType(category.type);
    } else {
      setName('');
      setCategoryType('EXPENSE');
    }
    setError(null);
  }, [category, open]);

  /**
   * Handle save
   */
  const handleSave = (): void => {
    setError(null);

    if (category) {
      // Update existing category
      void updateCategory({
        variables: {
          id: category.id,
          input: {
            name,
            type: categoryType,
          },
        },
      });
    } else {
      // Create new category
      void createCategory({
        variables: {
          input: {
            name,
            type: categoryType,
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
      title={category ? 'Edit Category' : 'Create Category'}
      actions={actions}
    >
      <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, minWidth: 400}}>
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

        <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
          <Typography variant="body2" color="text.secondary">
            Category Type
          </Typography>
          <ToggleButtonGroup
            value={categoryType}
            exclusive
            onChange={(_, newValue: string | null) => {
              if (newValue !== null && (newValue === 'INCOME' || newValue === 'EXPENSE')) {
                setCategoryType(newValue as 'INCOME' | 'EXPENSE');
              }
            }}
            aria-label="category type"
            fullWidth
          >
            <ToggleButton value="INCOME" aria-label="income">
              Income
            </ToggleButton>
            <ToggleButton value="EXPENSE" aria-label="expense">
              Expense
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
    </Dialog>
  );
}

