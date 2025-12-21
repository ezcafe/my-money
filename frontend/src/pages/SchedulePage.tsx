/**
 * Schedule Page
 * Manage recurring transactions
 */

import React from 'react';
import {Box, Typography} from '@mui/material';
import {Card} from '../components/ui/Card';

/**
 * Schedule Page Component
 */
export function SchedulePage(): React.JSX.Element {
  return (
    <Box sx={{width: '100%'}}>
      <Card sx={{p: 2}}>
        <Typography variant="body2" color="text.secondary">
          Recurring transactions list will be populated from GraphQL
        </Typography>
      </Card>
    </Box>
  );
}


