/**
 * Button Wrapper Component
 * Wraps MUI Button for abstraction
 */

import React from 'react';
import {Button as MUIButton, type ButtonProps as MUIButtonProps} from '@mui/material';

export interface ButtonProps extends Omit<MUIButtonProps, 'ref'> {
  children: React.ReactNode;
}

/**
 * Button component wrapper
 * Allows easy framework switching in the future
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({children, ...props}, ref) => {
    return (
      <MUIButton ref={ref} {...props}>
        {children}
      </MUIButton>
    );
  },
);

Button.displayName = 'Button';





