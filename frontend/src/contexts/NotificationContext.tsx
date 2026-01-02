/**
 * Notification Context
 * Manages budget notifications globally
 */

import React, {createContext, useContext, useState, useEffect, useCallback} from 'react';
import {useQuery, useMutation} from '@apollo/client/react';
import {Snackbar, Alert} from '@mui/material';
import {GET_BUDGET_NOTIFICATIONS} from '../graphql/queries';
import {MARK_BUDGET_NOTIFICATION_READ as MARK_READ_MUTATION} from '../graphql/mutations';

interface BudgetNotification {
  id: string;
  userId: string;
  budgetId: string;
  threshold: number;
  message: string;
  createdAt: string;
  budget?: {
    id: string;
    amount: string;
    currentSpent: string;
    percentageUsed: number;
    account?: {id: string; name: string};
    category?: {id: string; name: string};
    payee?: {id: string; name: string};
  };
}

interface NotificationContextType {
  notifications: BudgetNotification[];
  showNotification: (notification: BudgetNotification) => void;
  markAsRead: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Notification Provider Component
 */
export function NotificationProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const [currentNotification, setCurrentNotification] = useState<BudgetNotification | null>(null);
  const [open, setOpen] = useState(false);

  const {data, refetch} = useQuery<{budgetNotifications: BudgetNotification[]}>(GET_BUDGET_NOTIFICATIONS, {
    pollInterval: 30000, // Poll every 30 seconds
    fetchPolicy: 'network-only',
  });

  const [markAsReadMutation] = useMutation(MARK_READ_MUTATION, {
    refetchQueries: ['GetBudgetNotifications'],
  });

  const notifications = data?.budgetNotifications ?? [];

  // Show first unread notification
  useEffect(() => {
    if (notifications.length > 0 && !currentNotification) {
      const firstNotification = notifications[0];
      if (firstNotification) {
        setCurrentNotification(firstNotification);
        setOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.length, currentNotification]);

  const showNotification = useCallback((notification: BudgetNotification): void => {
    setCurrentNotification(notification);
    setOpen(true);
  }, []);

  const markAsRead = useCallback(async (id: string): Promise<void> => {
    try {
      await markAsReadMutation({
        variables: {id},
      });
      setOpen(false);
      setCurrentNotification(null);
      void refetch();
    } catch {
      // Error handled by mutation
    }
  }, [markAsReadMutation, refetch]);

  const handleClose = useCallback((_event?: React.SyntheticEvent | Event, reason?: string): void => {
    if (reason === 'clickaway') {
      return;
    }
    if (currentNotification) {
      void markAsRead(currentNotification.id);
    }
  }, [currentNotification, markAsRead]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (open && currentNotification) {
      const timer = setTimeout(() => {
        void markAsRead(currentNotification.id);
      }, 5000);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [open, currentNotification, markAsRead]);

  return (
    <NotificationContext.Provider value={{notifications, showNotification, markAsRead}}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{vertical: 'top', horizontal: 'center'}}
      >
        <Alert onClose={handleClose} severity="warning" sx={{width: '100%'}}>
          {currentNotification?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

/**
 * Hook to use notification context
 */
export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

