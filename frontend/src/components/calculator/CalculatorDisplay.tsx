/**
 * Calculator Display Component
 * Displays the current calculation value and top used values
 */

import React from 'react';
import { Box, Typography, Stack, Chip } from '@mui/material';
import { Button } from '../ui/Button';
import { BackspaceIcon } from './BackspaceIcon';
import { formatCurrencyPreserveDecimals } from '../../utils/formatting';

interface CalculatorDisplayProps {
  display: string;
  previousValue: number | null;
  operation: string | null;
  waitingForNewValue: boolean;
  showAmount: boolean;
  topUsedValues: Array<{ value: number; count: number }>;
  currency: string;
  onBackspace: () => void;
  onTopUsedValueClick: (value: number) => void;
  /** Optional: when set and showAmount is true, the amount area is clickable */
  onDisplayClick?: () => void;
}

/**
 * Calculator Display Component
 */
export function CalculatorDisplay({
  display,
  previousValue,
  operation,
  waitingForNewValue,
  showAmount,
  topUsedValues,
  currency,
  onBackspace,
  onTopUsedValueClick,
  onDisplayClick,
}: CalculatorDisplayProps): React.JSX.Element {
  const displayContent = showAmount ? (
    <Typography
      variant="h4"
      component="div"
      sx={{
        textAlign: 'right',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      {previousValue !== null && operation
        ? `${previousValue} ${operation} ${waitingForNewValue ? '' : display}`
        : display}
    </Typography>
  ) : null;

  return (
    <Box
      sx={{
        mb: 2,
        minHeight: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {showAmount ? (
        <Button variant="text" onClick={onBackspace}>
          <BackspaceIcon />
        </Button>
      ) : null}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {showAmount ? (
          onDisplayClick ? (
            <Box
              component="button"
              type="button"
              role="button"
              onClick={onDisplayClick}
              sx={{
                cursor: 'pointer',
                border: 'none',
                background: 'none',
                padding: 0,
                font: 'inherit',
                color: 'inherit',
                textAlign: 'right',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {displayContent}
            </Box>
          ) : (
            displayContent
          )
        ) : (
          topUsedValues.length > 0 && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                overflowX: 'auto',
                overflowY: 'hidden',
                width: '100%',
                justifyContent: 'flex-end',
              }}
            >
              {topUsedValues.slice(0, 5).map((item, index) => (
                <Chip
                  key={`${item.value}-${index}`}
                  label={formatCurrencyPreserveDecimals(item.value, currency)}
                  variant="outlined"
                  onClick={() => {
                    onTopUsedValueClick(Number(item.value));
                  }}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          )
        )}
      </Box>
    </Box>
  );
}
