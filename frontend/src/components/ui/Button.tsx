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
  ({children, sx, size, ...props}, ref) => {
    return (
      <MUIButton
        ref={ref}
        {...props}
        size={size}
        sx={{
          // Ensure minimum touch target size for mobile (44x44px)
          minHeight: {xs: 44, sm: size === 'small' ? 32 : size === 'large' ? 40 : 36},
          minWidth: {xs: 44, sm: 'auto'},
          // Add padding for better touch targets on mobile
          px: {xs: 2, sm: size === 'small' ? 1.5 : size === 'large' ? 3 : 2},
          py: {xs: 1.5, sm: size === 'small' ? 0.5 : size === 'large' ? 1.5 : 1},
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






















