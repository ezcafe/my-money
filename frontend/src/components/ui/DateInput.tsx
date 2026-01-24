/**
 * Enhanced Date Input Component
 * Provides date input with relative date shortcuts and quick date options
 */

import React, { useState, useCallback } from 'react';
import { TextField, Menu, MenuItem, Button, Box, Chip, Stack } from '@mui/material';
import { Today, DateRange } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';

export interface DateInputProps {
  /** Label for the date input */
  label: string;
  /** Current date value (ISO string or Dayjs object) */
  value: string | Dayjs | null;
  /** Callback when date changes */
  onChange: (date: string | null) => void;
  /** Whether field is required */
  required?: boolean;
  /** Whether to show relative date shortcuts */
  showShortcuts?: boolean;
  /** Custom date shortcuts */
  shortcuts?: Array<{ label: string; getDate: () => Dayjs }>;
}

/**
 * Get relative date shortcuts
 */
function getDefaultShortcuts(): Array<{ label: string; getDate: () => Dayjs }> {
  return [
    { label: 'Today', getDate: () => dayjs() },
    { label: 'Yesterday', getDate: () => dayjs().subtract(1, 'day') },
    { label: 'This Week', getDate: () => dayjs().startOf('week') },
    { label: 'Last Week', getDate: () => dayjs().subtract(1, 'week').startOf('week') },
    { label: 'This Month', getDate: () => dayjs().startOf('month') },
    { label: 'Last Month', getDate: () => dayjs().subtract(1, 'month').startOf('month') },
    { label: 'This Year', getDate: () => dayjs().startOf('year') },
    { label: 'Last Year', getDate: () => dayjs().subtract(1, 'year').startOf('year') },
  ];
}

/**
 * Enhanced Date Input Component
 * Provides date input with relative date shortcuts
 */
export function DateInput({
  label,
  value,
  onChange,
  required = false,
  showShortcuts = true,
  shortcuts,
}: DateInputProps): React.JSX.Element {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const dateShortcuts = shortcuts ?? getDefaultShortcuts();

  /**
   * Handle date picker button click
   */
  const handlePickerClick = useCallback(
    (event: React.MouseEvent<HTMLElement>): void => {
      if (showShortcuts) {
        setAnchorEl(event.currentTarget);
      } else {
        setIsPickerOpen(true);
      }
    },
    [showShortcuts]
  );

  /**
   * Handle shortcut selection
   */
  const handleShortcutClick = useCallback(
    (getDate: () => Dayjs): void => {
      const date = getDate();
      onChange(date.format('YYYY-MM-DD'));
      setAnchorEl(null);
    },
    [onChange]
  );

  /**
   * Handle date picker change
   */
  const handleDateChange = useCallback(
    (newValue: Dayjs | null): void => {
      if (newValue) {
        onChange(newValue.format('YYYY-MM-DD'));
      } else {
        onChange(null);
      }
      setIsPickerOpen(false);
    },
    [onChange]
  );

  /**
   * Format date for display
   */
  const displayValue = value ? (typeof value === 'string' ? dayjs(value) : value) : null;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <DatePicker
          label={label}
          value={displayValue}
          onChange={handleDateChange}
          open={isPickerOpen}
          onOpen={() => setIsPickerOpen(true)}
          onClose={() => setIsPickerOpen(false)}
          slots={{
            textField: (params: Parameters<typeof TextField>[0]) => {
              const inputProps = params.InputProps ?? {};
              return (
                <TextField
                  {...params}
                  required={required}
                  fullWidth
                  InputProps={{
                    ...inputProps,
                    endAdornment: showShortcuts ? (
                      <>
                        {inputProps.endAdornment}
                        <Button
                          size="small"
                          onClick={handlePickerClick}
                          sx={{ minWidth: 'auto', p: 1 }}
                          aria-label="Date shortcuts"
                        >
                          <DateRange fontSize="small" />
                        </Button>
                      </>
                    ) : (
                      inputProps.endAdornment
                    ),
                  }}
                />
              );
            },
          }}
        />
        {showShortcuts && dateShortcuts.length > 0 ? (
          <>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
            >
              {dateShortcuts.map((shortcut, index) => (
                <MenuItem key={index} onClick={() => handleShortcutClick(shortcut.getDate)}>
                  {shortcut.label}
                </MenuItem>
              ))}
            </Menu>
            {/* Quick date chips */}
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
              {dateShortcuts.slice(0, 4).map((shortcut, index) => (
                <Chip
                  key={index}
                  label={shortcut.label}
                  size="small"
                  onClick={() => handleShortcutClick(shortcut.getDate)}
                  icon={index === 0 ? <Today fontSize="small" /> : undefined}
                  variant={displayValue?.isSame(shortcut.getDate(), 'day') ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
          </>
        ) : null}
      </Box>
    </LocalizationProvider>
  );
}
