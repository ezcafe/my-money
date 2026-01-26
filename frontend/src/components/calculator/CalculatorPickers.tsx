/**
 * Calculator Pickers Component
 * Payee, Account, and Category selection pickers
 */

import React from 'react';
import { FormControl, Select, MenuItem, Autocomplete } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { TextField } from '../ui/TextField';
import {
  getAccountTypeLabel,
  getCategoryTypeLabel,
  GROUP_HEADER_STYLES,
} from '../../utils/groupSelectOptions';
import type { Account } from '../../hooks/useAccounts';
import type { Category } from '../../hooks/useCategories';

interface CalculatorPickersProps {
  selectedPayeeId: string;
  selectedAccountId: string;
  selectedCategoryId: string;
  payees: Array<{ id: string; name: string }>;
  accounts: Account[];
  categories: Category[];
  onPayeeChange: (payeeId: string) => void;
  onAccountChange: (accountId: string) => void;
  onCategoryChange: (categoryId: string) => void;
}

/**
 * Calculator Pickers Component
 */
export function CalculatorPickers({
  selectedPayeeId,
  selectedAccountId,
  selectedCategoryId,
  payees,
  accounts,
  categories,
  onPayeeChange,
  onAccountChange,
  onCategoryChange,
}: CalculatorPickersProps): React.JSX.Element {
  const selectHeight = '44px';

  // Find selected account and category objects for Autocomplete
  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId) ?? null;
  const selectedCategory = categories.find((cat) => cat.id === selectedCategoryId) ?? null;

  return (
    <Grid container spacing={1} sx={{ mb: 1 }}>
      {/* Payee Picker */}
      <Grid size={{ xs: 4 }}>
        <FormControl
          fullWidth
          sx={{
            '& .MuiOutlinedInput-root': {
              height: selectHeight,
            },
          }}
        >
          <Select
            value={selectedPayeeId || ''}
            onChange={(e) => {
              onPayeeChange(e.target.value);
            }}
            displayEmpty
          >
            {payees.map((payee) => (
              <MenuItem key={payee.id} value={payee.id}>
                {payee.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* Account Picker */}
      <Grid size={{ xs: 4 }}>
        <Autocomplete<Account, false, false, false>
          options={accounts}
          getOptionLabel={(option) => option.name}
          groupBy={(option) => getAccountTypeLabel(option.accountType)}
          value={selectedAccount}
          onChange={(_, value) => {
            onAccountChange(value?.id ?? '');
          }}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          componentsProps={{
            popper: {
              sx: GROUP_HEADER_STYLES,
            },
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              sx={{
                '& .MuiOutlinedInput-root': {
                  height: selectHeight,
                },
              }}
            />
          )}
        />
      </Grid>

      {/* Category Picker */}
      <Grid size={{ xs: 4 }}>
        <Autocomplete<Category, false, false, false>
          options={categories}
          getOptionLabel={(option) => option.name}
          groupBy={(option) => getCategoryTypeLabel(option.categoryType)}
          value={selectedCategory}
          onChange={(_, value) => {
            onCategoryChange(value?.id ?? '');
          }}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          componentsProps={{
            popper: {
              sx: GROUP_HEADER_STYLES,
            },
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              sx={{
                '& .MuiOutlinedInput-root': {
                  height: selectHeight,
                },
              }}
            />
          )}
        />
      </Grid>
    </Grid>
  );
}
