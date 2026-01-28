/**
 * MultiSelect Component
 * Reusable multi-select dropdown using MUI Autocomplete
 */

import React from 'react';
import { Autocomplete, TextField, Chip } from '@mui/material';
import { GROUP_HEADER_STYLES } from '../../utils/groupSelectOptions';

/**
 * Option type for MultiSelect.
 * Additional runtime fields are allowed (for example, categoryType).
 */
export interface MultiSelectOption {
  id: string;
  name: string;
}

/**
 * Props for MultiSelect component.
 * The generic parameter allows callers to extend the option shape while
 * keeping the core id/name fields required.
 */
export interface MultiSelectProps<TOption extends MultiSelectOption = MultiSelectOption> {
  /**
   * Label for the select field.
   */
  label: string;
  /**
   * Array of options to display.
   */
  options: TOption[];
  /**
   * Selected option IDs.
   */
  value: string[];
  /**
   * Callback when selection changes.
   */
  onChange: (value: string[]) => void;
  /**
   * Whether the field is disabled.
   */
  disabled?: boolean;
  /**
   * Whether the field is required.
   */
  required?: boolean;
  /**
   * Placeholder text.
   */
  placeholder?: string;
  /**
   * Optional grouping function for options.
   * When provided, options will be grouped under headers returned by this function.
   */
  groupBy?: (option: TOption) => string;
}

/**
 * MultiSelect Component.
 * Provides multi-select functionality with chip display and optional grouping support.
 *
 * @param props - MultiSelect props including options, value, and callbacks
 * @returns Multi-select autocomplete element
 */
export function MultiSelect<TOption extends MultiSelectOption = MultiSelectOption>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder,
  groupBy,
}: MultiSelectProps<TOption>): React.JSX.Element {
  /**
   * Get selected option objects from IDs.
   */
  const selectedOptions = options.filter((option) => value.includes(option.id));

  /**
   * Handle selection change.
   */
  const handleChange = (_: unknown, newValue: TOption[]): void => {
    onChange(newValue.map((option) => option.id));
  };

  return (
    <Autocomplete<TOption, true, false, false>
      multiple
      size="small"
      options={options}
      getOptionLabel={(option) => option.name}
      groupBy={groupBy}
      value={selectedOptions}
      onChange={handleChange}
      disabled={disabled}
      componentsProps={
        groupBy
          ? {
              popper: {
                sx: GROUP_HEADER_STYLES,
              },
            }
          : undefined
      }
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
