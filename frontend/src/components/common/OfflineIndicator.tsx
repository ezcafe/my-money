/**
 * Offline Indicator Component
 * Shows when the app is offline or has network connectivity issues
 */

import React, { useState, useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useOfflineSync } from '../../hooks/useOfflineSync';

/**
 * Offline Indicator Component
 * Displays a notification when the app goes offline and shows queue status
 */
export function OfflineIndicator(): React.JSX.Element {
  const [showOffline, setShowOffline] = useState(false);
  const { networkStatus } = useOfflineSync({ autoSync: true });

  useEffect(() => {
    setShowOffline(!networkStatus.isOnline || networkStatus.queueSize > 0);
  }, [networkStatus.isOnline, networkStatus.queueSize]);

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string): void => {
    if (reason === 'clickaway') {
      return;
    }
    setShowOffline(false);
  };

  const getMessage = (): string => {
    if (!networkStatus.isOnline) {
      return 'You are currently offline. Some features may not be available.';
    }
    if (networkStatus.queueSize > 0) {
      return `${networkStatus.queueSize} mutation(s) queued. Syncing...`;
    }
    return '';
  };

  const getSeverity = (): 'warning' | 'info' => {
    return !networkStatus.isOnline ? 'warning' : 'info';
  };

  return (
    <Snackbar
      open={showOffline}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      onClose={handleClose}
    >
      <Alert onClose={handleClose} severity={getSeverity()} sx={{ width: '100%' }}>
        {getMessage()}
      </Alert>
    </Snackbar>
  );
}
