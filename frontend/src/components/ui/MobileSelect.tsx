/**
 * Mobile Select Component
 * Provides a wrapper around native MUI select components.
 */

import React, { useId } from 'react';
import { FormControl, InputLabel, Select, MenuItem, Autocomplete } from '@mui/material';
import { TextField } from './TextField';
import { GROUP_HEADER_STYLES } from '../../utils/groupSelectOptions';

export interface MobileSelectOption<T = unknown> {
  id: string;
  name: string;
  value: T;
}

export interface MobileSelectProps<T = unknown> {
  /** Current selected value */
  value: T | null;
  /** Array of options to select from */
  options: T[];
  /** Callback when selection changes */
  onChange: (value: T | null) => void;
  /** Function to get label from option */
  getOptionLabel: (option: T) => string;
  /** Function to get unique ID from option */
  getOptionId?: (option: T) => string;
  /** Function to check if two options are equal */
  isOptionEqualToValue?: (option: T, value: T) => boolean;
  /** Optional grouping function */
  groupBy?: (option: T) => string;
  /** Label for the select field */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Custom render function for option in mobile list */
  renderOption?: (option: T, isSelected: boolean) => React.ReactNode;
  /** Size of the select field */
  size?: 'small' | 'medium';
  /** Full width */
  fullWidth?: boolean;
  /** Custom sx styles */
  sx?: Record<string, unknown>;
}

/**
 * Mobile Select Component
 * Renders standard MUI `Select`/`Autocomplete` on all devices.
 */
export function MobileSelect<T = unknown>({
  value,
  options,
  onChange,
  getOptionLabel,
  getOptionId,
  isOptionEqualToValue,
  groupBy,
  label,
  placeholder,
  disabled = false,
  required = false,
  size = 'medium',
  fullWidth = true,
  sx,
}: MobileSelectProps<T>): React.JSX.Element {
  const labelId = useId();

  /**
   * Get option ID helper
   */
  const getId = (option: T): string => {
    if (getOptionId) {
      return getOptionId(option);
    }
    // Try to get id property if it exists
    if (typeof option === 'object' && option !== null && 'id' in option) {
      return String((option as { id: unknown }).id);
    }
    return getOptionLabel(option);
  };

  /**
   * Check if option equals value
   */
  const isEqual = (option: T, val: T | null): boolean => {
    if (val === null) {
      return false;
    }
    if (isOptionEqualToValue) {
      return isOptionEqualToValue(option, val);
    }
    return getId(option) === getId(val);
  };

  return (
    <>
      {groupBy ? (
        // Use Autocomplete for grouped options
        <Autocomplete<T, false, false, false>
          options={options}
          getOptionLabel={getOptionLabel}
          value={value}
          onChange={(_, newValue) => {
            onChange(newValue);
          }}
          isOptionEqualToValue={isOptionEqualToValue ?? isEqual}
          groupBy={groupBy}
          componentsProps={{
            popper: {
              sx: GROUP_HEADER_STYLES,
            },
          }}
          disabled={disabled}
          fullWidth={fullWidth}
          size={size}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              placeholder={placeholder}
              required={required}
              sx={sx}
            />
          )}
        />
      ) : (
        // Use Select for simple options
        <FormControl fullWidth={fullWidth} size={size} disabled={disabled} required={required} sx={sx}>
          {label ? <InputLabel id={labelId}>{label}</InputLabel> : null}
          <Select
            labelId={label ? labelId : undefined}
            value={value ? getId(value) : ''}
            label={label}
            onChange={(e) => {
              const selectedOption = options.find((opt) => getId(opt) === e.target.value);
              onChange(selectedOption ?? null);
            }}
            disabled={disabled}
          >
            {options.map((option) => (
              <MenuItem key={getId(option)} value={getId(option)}>
                {getOptionLabel(option)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </>
  );
}
