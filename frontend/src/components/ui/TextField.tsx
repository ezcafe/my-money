/**
 * TextField Wrapper Component
 * Wraps MUI TextField for abstraction
 */

import React from 'react';
import { TextField as MUITextField, type TextFieldProps as MUITextFieldProps } from '@mui/material';

export type TextFieldProps = Omit<MUITextFieldProps, 'ref'>;

/**
 * TextField component wrapper
 * Allows easy framework switching in the future
 */
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>((props, ref) => {
  return <MUITextField ref={ref} {...props} />;
});

TextField.displayName = 'TextField';
