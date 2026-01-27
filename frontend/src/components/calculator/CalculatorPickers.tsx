/**
 * Calculator Pickers Component
 * Payee, Account, and Category selection pickers
 */

import React from 'react';
import Grid from '@mui/material/Grid2';
import { MobileSelect } from '../ui/MobileSelect';
import {
  getAccountTypeLabel,
  getCategoryTypeLabel,
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
        <MobileSelect<{ id: string; name: string }>
          value={payees.find((p) => p.id === selectedPayeeId) ?? null}
          options={payees}
          onChange={(payee) => {
            onPayeeChange(payee?.id ?? '');
          }}
          getOptionLabel={(option) => option.name}
          getOptionId={(option) => option.id}
          placeholder="Payee"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              height: selectHeight,
            },
          }}
        />
      </Grid>

      {/* Account Picker */}
      <Grid size={{ xs: 4 }}>
        <MobileSelect<Account>
          value={selectedAccount}
          options={accounts}
          onChange={(account) => {
            onAccountChange(account?.id ?? '');
          }}
          getOptionLabel={(option) => option.name}
          getOptionId={(option) => option.id}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          groupBy={(option) => getAccountTypeLabel(option.accountType)}
          placeholder="Account"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              height: selectHeight,
            },
          }}
        />
      </Grid>

      {/* Category Picker */}
      <Grid size={{ xs: 4 }}>
        <MobileSelect<Category>
          value={selectedCategory}
          options={categories}
          onChange={(category) => {
            onCategoryChange(category?.id ?? '');
          }}
          getOptionLabel={(option) => option.name}
          getOptionId={(option) => option.id}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          groupBy={(option) => getCategoryTypeLabel(option.categoryType)}
          placeholder="Category"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              height: selectHeight,
            },
          }}
        />
      </Grid>
    </Grid>
  );
}
