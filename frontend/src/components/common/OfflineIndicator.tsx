/**
 * Offline Indicator Component
 * Shows when the app is offline or has network connectivity issues
 */

import React, {useState, useEffect} from 'react';
import {Snackbar, Alert} from '@mui/material';

/**
 * Offline Indicator Component
 * Displays a notification when the app goes offline
 */
export function OfflineIndicator(): React.JSX.Element {
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    const handleOnline = (): void => {
      setShowOffline(false);
    };

    const handleOffline = (): void => {
      setShowOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setShowOffline(true);
    }

    return (): void => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string): void => {
    if (reason === 'clickaway') {
      return;
    }
    setShowOffline(false);
  };

  return (
    <Snackbar
      open={showOffline}
      anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
      onClose={handleClose}
    >
      <Alert onClose={handleClose} severity="warning" sx={{width: '100%'}}>
        You are currently offline. Some features may not be available.
      </Alert>
    </Snackbar>
  );
}

