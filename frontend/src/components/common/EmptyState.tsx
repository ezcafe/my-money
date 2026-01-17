/**
 * Empty State Component
 * Standardized empty state display following Material Design 3 patterns
 */

import React from 'react';
import {Box, Typography} from '@mui/material';
import {Card} from '../ui/Card';

export interface EmptyStateProps {
  /**
   * Icon to display (optional)
   */
  icon?: React.ReactNode;
  /**
   * Title text
   */
  title: string;
  /**
   * Description text
   */
  description?: string;
  /**
   * Action button (optional)
   */
  action?: React.ReactNode;
}

/**
 * Empty State Component
 * Displays a consistent empty state following M3 design patterns
 * Enhanced with better messaging and action support
 */
export function EmptyState({icon, title, description, action}: EmptyStateProps): React.JSX.Element {
  return (
    <Card sx={{p: {xs: 3, sm: 4}}}>
      <Box sx={{textAlign: 'center', py: {xs: 3, sm: 4}}}>
        {icon ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 2,
              '& svg': {
                fontSize: {xs: 48, sm: 64},
                color: 'text.secondary',
                opacity: 0.5,
              },
            }}
          >
            {icon}
          </Box>
        ) : null}
        <Typography 
          variant="h6" 
          color="text.secondary" 
          sx={{
            mb: 1,
            fontSize: {xs: '1.1rem', sm: '1.25rem'},
          }}
        >
          {title}
        </Typography>
        {description ? (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{
              mb: action ? 3 : 0,
              maxWidth: '500px',
              mx: 'auto',
              px: {xs: 2, sm: 0},
            }}
          >
            {description}
          </Typography>
        ) : null}
        {action ? (
          <Box sx={{mt: 2, display: 'flex', justifyContent: 'center'}}>
            {action}
          </Box>
        ) : null}
      </Box>
    </Card>
  );
}

