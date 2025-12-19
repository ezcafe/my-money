/**
 * Schedule Page
 * Manage recurring transactions
 */

import React from 'react';
import {Box, Typography} from '@mui/material';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';

/**
 * Schedule Page Component
 */
export function SchedulePage(): JSX.Element {
  return (
    <Box sx={{p: 2, maxWidth: 800, mx: 'auto'}}>
      <Typography variant="h4" gutterBottom>
        Recurring Transactions
      </Typography>

      <Card sx={{p: 2}}>
        <Button variant="contained" sx={{mb: 2}}>
          Add Recurring Transaction
        </Button>
        {/* Recurring transactions list will be populated from GraphQL */}
      </Card>
    </Box>
  );
}


