/**
 * Loading Spinner Component
 * Reusable loading indicator
 */

import React from 'react';
import {Box, CircularProgress, Typography} from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
}

/**
 * Loading Spinner Component
 * Displays a loading indicator with optional message
 */
export function LoadingSpinner({message, fullScreen = false}: LoadingSpinnerProps): React.JSX.Element {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        ...(fullScreen && {
          minHeight: '100vh',
        }),
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

