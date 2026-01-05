/**
 * Card Wrapper Component
 * Wraps MUI Card for abstraction
 */

import React from 'react';
import {Card as MUICard, type CardProps as MUICardProps} from '@mui/material';

export interface CardProps extends MUICardProps {
  children: React.ReactNode;
}

/**
 * Card component wrapper
 * Allows easy framework switching in the future
 * Enhanced with smooth transitions and better visual feedback
 */
export const Card: React.FC<CardProps> = ({children, sx, ...props}) => {
  return (
    <MUICard
      {...props}
      sx={{
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: (theme) => theme.shadows[4],
        },
        ...sx,
      }}
    >
      {children}
    </MUICard>
  );
};






















