/**
 * Error Alert Component
 * Reusable error display component
 */

import React from 'react';
import {Alert, AlertTitle, Box} from '@mui/material';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onClose?: () => void;
  severity?: 'error' | 'warning' | 'info';
}

/**
 * Error Alert Component
 * Displays error messages in a user-friendly way
 */
export function ErrorAlert({
  title,
  message,
  onClose,
  severity = 'error',
}: ErrorAlertProps): React.JSX.Element {
  return (
    <Box sx={{mb: 2}}>
      <Alert severity={severity} onClose={onClose}>
        {title && <AlertTitle>{title}</AlertTitle>}
        {message}
      </Alert>
    </Box>
  );
}

