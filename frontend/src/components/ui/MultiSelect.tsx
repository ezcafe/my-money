/**
 * MultiSelect Component
 * Reusable multi-select dropdown using MUI Autocomplete
 */

import React from 'react';
import { Autocomplete, TextField, Chip } from '@mui/material';

/**
 * Option type for MultiSelect
 */
export interface MultiSelectOption {
  id: string;
  name: string;
}

/**
 * Props for MultiSelect component
 */
export interface MultiSelectProps {
  /**
   * Label for the select field
   */
  label: string;
  /**
   * Array of options to display
   */
  options: MultiSelectOption[];
  /**
   * Selected option IDs
   */
  value: string[];
  /**
   * Callback when selection changes
   */
  onChange: (value: string[]) => void;
  /**
   * Whether the field is disabled
   */
  disabled?: boolean;
  /**
   * Whether the field is required
   */
  required?: boolean;
  /**
   * Placeholder text
   */
  placeholder?: string;
}

/**
 * MultiSelect Component
 * Provides multi-select functionality with chip display
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder,
}: MultiSelectProps): React.JSX.Element {
  /**
   * Get selected option objects from IDs
   */
  const selectedOptions = options.filter((option) => value.includes(option.id));

  /**
   * Handle selection change
   */
  const handleChange = (_: unknown, newValue: MultiSelectOption[]): void => {
    onChange(newValue.map((option) => option.id));
  };

  return (
    <Autocomplete
      multiple
      options={options}
      getOptionLabel={(option) => option.name}
      value={selectedOptions}
      onChange={handleChange}
      disabled={disabled}
      renderInput={(params) => (
        <TextField {...params} label={label} required={required} placeholder={placeholder} />
      )}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip {...getTagProps({ index })} key={option.id} label={option.name} />
        ))
      }
    />
  );
}
