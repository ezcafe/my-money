/**
 * Loading Spinner Component
 * Reusable loading indicator
 */

import React from 'react';
import {Box, CircularProgress, Typography} from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
}

/**
 * Loading Spinner Component
 * Displays a loading indicator with optional message
 */
export function LoadingSpinner({message}: LoadingSpinnerProps): React.JSX.Element {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <CircularProgress />
      {message && (
        <Typography variant="body1" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );

  return content;
}

