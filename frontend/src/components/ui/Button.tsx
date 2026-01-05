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
 * Enhanced with smooth transitions and better visual feedback
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({children, sx, ...props}, ref) => {
    return (
      <MUIButton
        ref={ref}
        {...props}
        sx={{
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: (theme) => theme.shadows[4],
          },
          '&:active': {
            transform: 'translateY(0)',
          },
          ...sx,
        }}
      >
        {children}
      </MUIButton>
    );
  },
);

Button.displayName = 'Button';






















