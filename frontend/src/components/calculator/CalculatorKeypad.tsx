/**
 * Calculator Keypad Component
 * Number and operation buttons
 */

import React from 'react';
import {FormControl, Select, MenuItem, Autocomplete} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {ArrowForward as GoIcon} from '@mui/icons-material';
import {MoreHorizOutlined as MoreIcon} from '@mui/icons-material';
import {Button} from '../ui/Button';
import {TextField} from '../ui/TextField';
import {
  getAccountTypeLabel,
  getCategoryTypeLabel,
  GROUP_HEADER_STYLES,
} from '../../utils/groupSelectOptions';
import type {Account} from '../../hooks/useAccounts';
import type {Category} from '../../hooks/useCategories';

interface CalculatorKeypadProps {
  selectedPayeeId: string;
  selectedAccountId: string;
  selectedCategoryId: string;
  payees: Array<{id: string; name: string}>;
  accounts: Account[];
  categories: Category[];
  useThousandSeparator: boolean;
  creatingTransaction: boolean;
  canSubmit: boolean;
  onNumberClick: (num: string) => void;
  onOperationClick: (op: string) => void;
  onEqualsClick: () => void;
  onPayeeChange: (payeeId: string) => void;
  onAccountChange: (accountId: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onSettingsClick: (event: React.MouseEvent<HTMLElement>) => void;
}

/**
 * Calculator Keypad Component
 */
export function CalculatorKeypad({
  selectedPayeeId,
  selectedAccountId,
  selectedCategoryId,
  payees,
  accounts,
  categories,
  useThousandSeparator,
  creatingTransaction,
  canSubmit,
  onNumberClick,
  onOperationClick,
  onEqualsClick,
  onPayeeChange,
  onAccountChange,
  onCategoryChange,
  onSettingsClick,
}: CalculatorKeypadProps): React.JSX.Element {
  const buttonHeight = '40px';
  const selectHeight = '44px';

  // Find selected account and category objects for Autocomplete
  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId) ?? null;
  const selectedCategory = categories.find((cat) => cat.id === selectedCategoryId) ?? null;

  return (
    <Grid container spacing={1}>
      {/* Row 1: Payee, Account, Category, ÷ */}
      <Grid size={{xs: 3}}>
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
      <Grid size={{xs: 3}}>
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
      <Grid size={{xs: 3}}>
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
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => {
            onOperationClick('/');
          }}
          sx={{height: buttonHeight}}
        >
          ÷
        </Button>
      </Grid>

      {/* Row 2: 7, 8, 9, × */}
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('7');
          }}
          sx={{height: buttonHeight}}
        >
          7
        </Button>
      </Grid>
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('8');
          }}
          sx={{height: buttonHeight}}
        >
          8
        </Button>
      </Grid>
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('9');
          }}
          sx={{height: buttonHeight}}
        >
          9
        </Button>
      </Grid>
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => {
            onOperationClick('*');
          }}
          sx={{height: buttonHeight}}
        >
          ×
        </Button>
      </Grid>

      {/* Row 3: 4, 5, 6, − */}
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('4');
          }}
          sx={{height: buttonHeight}}
        >
          4
        </Button>
      </Grid>
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('5');
          }}
          sx={{height: buttonHeight}}
        >
          5
        </Button>
      </Grid>
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('6');
          }}
          sx={{height: buttonHeight}}
        >
          6
        </Button>
      </Grid>
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => {
            onOperationClick('-');
          }}
          sx={{height: buttonHeight}}
        >
          −
        </Button>
      </Grid>

      {/* Row 4: 1, 2, 3, + */}
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('1');
          }}
          sx={{height: buttonHeight}}
        >
          1
        </Button>
      </Grid>
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('2');
          }}
          sx={{height: buttonHeight}}
        >
          2
        </Button>
      </Grid>
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('3');
          }}
          sx={{height: buttonHeight}}
        >
          3
        </Button>
      </Grid>
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => {
            onOperationClick('+');
          }}
          sx={{height: buttonHeight}}
        >
          +
        </Button>
      </Grid>

      {/* Row 5: Settings, 0, 000/., = */}
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="outlined"
          onClick={onSettingsClick}
          aria-label="Preferences"
          sx={{height: buttonHeight}}
        >
          <MoreIcon />
        </Button>
      </Grid>
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('0');
          }}
          sx={{height: buttonHeight}}
        >
          0
        </Button>
      </Grid>
      <Grid size={{xs: 3}}>
        {useThousandSeparator ? (
          <Button
            fullWidth
            variant="contained"
            onClick={() => {
              onNumberClick('000');
            }}
            sx={{height: buttonHeight}}
          >
            000
          </Button>
        ) : (
          <Button
            fullWidth
            variant="contained"
            onClick={() => {
              onNumberClick('.');
            }}
            sx={{height: buttonHeight}}
          >
            .
          </Button>
        )}
      </Grid>
      <Grid size={{xs: 3}}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={onEqualsClick}
          disabled={creatingTransaction || !canSubmit}
          sx={{height: buttonHeight}}
        >
          {creatingTransaction ? '...' : <GoIcon />}
        </Button>
      </Grid>
    </Grid>
  );
}

