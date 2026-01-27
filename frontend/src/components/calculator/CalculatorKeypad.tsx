/**
 * Calculator Keypad Component
 * Number and operation buttons with support for multiple layouts
 */

import React from 'react';
import Grid from '@mui/material/Grid2';
import { ArrowForward as GoIcon } from '@mui/icons-material';
import { MoreHorizOutlined as MoreIcon } from '@mui/icons-material';
import { Button } from '../ui/Button';

export type KeypadLayout = 'layout1' | 'layout2' | 'layout3';

interface CalculatorKeypadProps {
  keypadLayout: KeypadLayout;
  useThousandSeparator: boolean;
  creatingTransaction: boolean;
  canSubmit: boolean;
  onNumberClick: (num: string) => void;
  onOperationClick: (op: string) => void;
  onEqualsClick: () => void;
  onSettingsClick: (event: React.MouseEvent<HTMLElement>) => void;
}

/**
 * Calculator Keypad Component
 */
export function CalculatorKeypad({
  keypadLayout,
  useThousandSeparator,
  creatingTransaction,
  canSubmit,
  onNumberClick,
  onOperationClick,
  onEqualsClick,
  onSettingsClick,
}: CalculatorKeypadProps): React.JSX.Element {
  const buttonSx = {
    width: '100%',
    minHeight: {
      xs: 56,
      sm: 64,
    },
  } as const;

  /**
   * Render Layout 1 (default): 4x4 grid with operations on right
   * Row 1: 7, 8, 9, *
   * Row 2: 4, 5, 6, -
   * Row 3: 1, 2, 3, +
   * Row 4: Settings, 0, . or 000, Go
   */
  const renderLayout1 = (): React.JSX.Element => (
    <>
      {/* Row 1: 7, 8, 9, × */}
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('7');
          }}
          sx={buttonSx}
        >
          7
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('8');
          }}
          sx={buttonSx}
        >
          8
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('9');
          }}
          sx={buttonSx}
        >
          9
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => {
            onOperationClick('*');
          }}
          sx={buttonSx}
        >
          ×
        </Button>
      </Grid>

      {/* Row 2: 4, 5, 6, − */}
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('4');
          }}
          sx={buttonSx}
        >
          4
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('5');
          }}
          sx={buttonSx}
        >
          5
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('6');
          }}
          sx={buttonSx}
        >
          6
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => {
            onOperationClick('-');
          }}
          sx={buttonSx}
        >
          −
        </Button>
      </Grid>

      {/* Row 3: 1, 2, 3, + */}
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('1');
          }}
          sx={buttonSx}
        >
          1
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('2');
          }}
          sx={buttonSx}
        >
          2
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('3');
          }}
          sx={buttonSx}
        >
          3
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => {
            onOperationClick('+');
          }}
          sx={buttonSx}
        >
          +
        </Button>
      </Grid>

      {/* Row 4: Settings, 0, . or 000, Go */}
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={onSettingsClick}
          aria-label="Settings"
          sx={buttonSx}
        >
          <MoreIcon />
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('0');
          }}
          sx={buttonSx}
        >
          0
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        {useThousandSeparator ? (
          <Button
            fullWidth
            variant="contained"
            onClick={() => {
              onNumberClick('000');
            }}
            sx={buttonSx}
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
            sx={buttonSx}
          >
            .
          </Button>
        )}
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={onEqualsClick}
          disabled={creatingTransaction || !canSubmit}
          sx={buttonSx}
        >
          {creatingTransaction ? '...' : <GoIcon />}
        </Button>
      </Grid>
    </>
  );

  /**
   * Render Layout 2: 3x4 grid (no operations column, no decimal/000)
   * Row 1: 7, 8, 9
   * Row 2: 4, 5, 6
   * Row 3: 1, 2, 3
   * Row 4: Settings, 0, Go
   */
  const renderLayout2 = (): React.JSX.Element => (
    <>
      {/* Row 1: 7, 8, 9 */}
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('7');
          }}
          sx={buttonSx}
        >
          7
        </Button>
      </Grid>
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('8');
          }}
          sx={buttonSx}
        >
          8
        </Button>
      </Grid>
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('9');
          }}
          sx={buttonSx}
        >
          9
        </Button>
      </Grid>

      {/* Row 2: 4, 5, 6 */}
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('4');
          }}
          sx={buttonSx}
        >
          4
        </Button>
      </Grid>
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('5');
          }}
          sx={buttonSx}
        >
          5
        </Button>
      </Grid>
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('6');
          }}
          sx={buttonSx}
        >
          6
        </Button>
      </Grid>

      {/* Row 3: 1, 2, 3 */}
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('1');
          }}
          sx={buttonSx}
        >
          1
        </Button>
      </Grid>
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('2');
          }}
          sx={buttonSx}
        >
          2
        </Button>
      </Grid>
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('3');
          }}
          sx={buttonSx}
        >
          3
        </Button>
      </Grid>

      {/* Row 4: Settings, 0, Go */}
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={onSettingsClick}
          aria-label="Settings"
          sx={buttonSx}
        >
          <MoreIcon />
        </Button>
      </Grid>
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('0');
          }}
          sx={buttonSx}
        >
          0
        </Button>
      </Grid>
      <Grid size={{ xs: 4 }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={onEqualsClick}
          disabled={creatingTransaction || !canSubmit}
          sx={buttonSx}
        >
          {creatingTransaction ? '...' : <GoIcon />}
        </Button>
      </Grid>
    </>
  );

  /**
   * Render Layout 3: 4x4 grid with operations on left
   * Row 1: +, 7, 8, 9
   * Row 2: -, 4, 5, 6
   * Row 3: *, 1, 2, 3
   * Row 4: Settings, 0, . or 000, Go
   */
  const renderLayout3 = (): React.JSX.Element => (
    <>
      {/* Row 1: +, 7, 8, 9 */}
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => {
            onOperationClick('+');
          }}
          sx={buttonSx}
        >
          +
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('7');
          }}
          sx={buttonSx}
        >
          7
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('8');
          }}
          sx={buttonSx}
        >
          8
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('9');
          }}
          sx={buttonSx}
        >
          9
        </Button>
      </Grid>

      {/* Row 2: -, 4, 5, 6 */}
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => {
            onOperationClick('-');
          }}
          sx={buttonSx}
        >
          −
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('4');
          }}
          sx={buttonSx}
        >
          4
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('5');
          }}
          sx={buttonSx}
        >
          5
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('6');
          }}
          sx={buttonSx}
        >
          6
        </Button>
      </Grid>

      {/* Row 3: *, 1, 2, 3 */}
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => {
            onOperationClick('*');
          }}
          sx={buttonSx}
        >
          ×
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('1');
          }}
          sx={buttonSx}
        >
          1
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('2');
          }}
          sx={buttonSx}
        >
          2
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('3');
          }}
          sx={buttonSx}
        >
          3
        </Button>
      </Grid>

      {/* Row 4: Settings, 0, . or 000, Go */}
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={onSettingsClick}
          aria-label="Settings"
          sx={buttonSx}
        >
          <MoreIcon />
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            onNumberClick('0');
          }}
          sx={buttonSx}
        >
          0
        </Button>
      </Grid>
      <Grid size={{ xs: 3 }}>
        {useThousandSeparator ? (
          <Button
            fullWidth
            variant="contained"
            onClick={() => {
              onNumberClick('000');
            }}
            sx={buttonSx}
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
            sx={buttonSx}
          >
            .
          </Button>
        )}
      </Grid>
      <Grid size={{ xs: 3 }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={onEqualsClick}
          disabled={creatingTransaction || !canSubmit}
          sx={buttonSx}
        >
          {creatingTransaction ? '...' : <GoIcon />}
        </Button>
      </Grid>
    </>
  );

  return (
    <Grid
      container
      spacing={1}
      sx={{
        width: '100%',
      }}
    >
      {keypadLayout === 'layout1' && renderLayout1()}
      {keypadLayout === 'layout2' && renderLayout2()}
      {keypadLayout === 'layout3' && renderLayout3()}
    </Grid>
  );
}
