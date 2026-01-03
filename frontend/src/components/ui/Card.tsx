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
 */
export const Card: React.FC<CardProps> = ({children, ...props}) => {
  return <MUICard {...props}>{children}</MUICard>;
};



















