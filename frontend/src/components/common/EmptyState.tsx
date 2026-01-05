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
 */
export function EmptyState({icon, title, description, action}: EmptyStateProps): React.JSX.Element {
  return (
    <Card sx={{p: 4}}>
      <Box sx={{textAlign: 'center', py: 4}}>
        {icon && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 2,
              '& svg': {
                fontSize: 64,
                color: 'text.secondary',
                opacity: 0.5,
              },
            }}
          >
            {icon}
          </Box>
        )}
        <Typography variant="h6" color="text.secondary" sx={{mb: 1}}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{mb: 3, maxWidth: '500px', mx: 'auto'}}>
            {description}
          </Typography>
        )}
        {action && <Box sx={{mt: 2}}>{action}</Box>}
      </Box>
    </Card>
  );
}

