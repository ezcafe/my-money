/**
 * Calculator Keypad Component
 * Number and operation buttons
 */

import React from 'react';
import {Grid, FormControl, Select, MenuItem} from '@mui/material';
import {ArrowForward as GoIcon} from '@mui/icons-material';
import {MoreHorizOutlined as MoreIcon} from '@mui/icons-material';
import {Button} from '../ui/Button';

interface CalculatorKeypadProps {
  selectedPayeeId: string;
  selectedAccountId: string;
  selectedCategoryId: string;
  payees: Array<{id: string; name: string}>;
  accounts: Array<{id: string; name: string}>;
  categories: Array<{id: string; name: string}>;
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
  return (
    <>
      {/* Row 1: Payee, Account, Category, ÷ */}
      <Grid item xs={3}>
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
      <Grid item xs={3}>
        <FormControl
          fullWidth
          sx={{
            '& .MuiOutlinedInput-root': {
              height: selectHeight,
            },
          }}
        >
          <Select
            value={selectedAccountId || ''}
            onChange={(e) => {
              onAccountChange(e.target.value);
            }}
            displayEmpty
          >
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={3}>
        <FormControl
          fullWidth
          sx={{
            '& .MuiOutlinedInput-root': {
              height: selectHeight,
            },
          }}
        >
          <Select
            value={selectedCategoryId || ''}
            onChange={(e) => {
              onCategoryChange(e.target.value);
            }}
            displayEmpty
          >
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
      <Grid item xs={3}>
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
    </>
  );
}

