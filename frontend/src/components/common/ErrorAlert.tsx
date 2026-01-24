/**
 * Error Alert Component
 * Reusable error display component with retry functionality
 */

import React from 'react';
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { Refresh } from '@mui/icons-material';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onClose?: () => void;
  onRetry?: () => void;
  severity?: 'error' | 'warning' | 'info';
  retryLabel?: string;
}

/**
 * Error Alert Component
 * Displays error messages in a user-friendly way with optional retry button
 */
export function ErrorAlert({
  title,
  message,
  onClose,
  onRetry,
  severity = 'error',
  retryLabel = 'Retry',
}: ErrorAlertProps): React.JSX.Element {
  return (
    <Box sx={{ mb: 2 }}>
      <Alert
        severity={severity}
        onClose={onClose}
        action={
          onRetry ? (
            <Button
              color="inherit"
              size="small"
              onClick={onRetry}
              startIcon={<Refresh />}
              sx={{ textTransform: 'none' }}
            >
              {retryLabel}
            </Button>
          ) : undefined
        }
      >
        {title ? <AlertTitle>{title}</AlertTitle> : null}
        {message}
      </Alert>
    </Box>
  );
}
