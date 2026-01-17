/**
 * Error Page Component
 * Reusable error page component for displaying error messages
 */

import React from 'react';
import {Box, Typography, Button} from '@mui/material';
import {Card} from '../ui/Card';

interface ErrorPageProps {
  /** Optional error message to display */
  errorMessage?: string;
  /** Optional reset handler for the Try again button */
  onReset?: () => void;
  /** Whether to show the Try again button */
  showResetButton?: boolean;
}

/**
 * Error Page Component
 * Displays a user-friendly error page with consistent styling
 */
export function ErrorPage({
  errorMessage,
  onReset,
  showResetButton = false,
}: ErrorPageProps): React.JSX.Element {
  return (
    <Box sx={{mx: 'auto'}}>
      <Card sx={{p: 3}}>
        <Typography variant="h5" component="h1" color="error" gutterBottom>
          Something went wrong on this page
        </Typography>
        <Typography variant="body1" sx={{mb: 2}}>
          {errorMessage ?? 'Please try refreshing the page or navigating away.'}
        </Typography>
        {showResetButton && onReset !== undefined ? (
          <Button variant="contained" onClick={onReset}>
            Try again
          </Button>
        ) : null}
      </Card>
    </Box>
  );
}
