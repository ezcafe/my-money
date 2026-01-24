/**
 * Notification Context
 * Manages budget notifications globally
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Snackbar, Alert } from '@mui/material';
import { GET_BUDGET_NOTIFICATIONS } from '../graphql/queries';
import { MARK_BUDGET_NOTIFICATION_READ as MARK_READ_MUTATION } from '../graphql/mutations';
import { NOTIFICATION_POLL_INTERVAL_MS, NOTIFICATION_AUTO_DISMISS_MS } from '../constants';
import { getUserFriendlyErrorMessage } from '../utils/errorNotification';

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
    account?: { id: string; name: string };
    category?: { id: string; name: string };
    payee?: { id: string; name: string };
  };
}

interface NotificationContextType {
  notifications: BudgetNotification[];
  showNotification: (notification: BudgetNotification) => void;
  markAsRead: (id: string) => Promise<void>;
  showSuccessNotification: (message: string) => void;
  showErrorNotification: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Notification Provider Component
 */
export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [currentNotification, setCurrentNotification] = useState<BudgetNotification | null>(null);
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const processedNotificationIds = useRef<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(true);

  // Pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const { data, refetch } = useQuery<{ budgetNotifications: BudgetNotification[] }>(
    GET_BUDGET_NOTIFICATIONS,
    {
      pollInterval: isVisible ? NOTIFICATION_POLL_INTERVAL_MS : 0,
      fetchPolicy: 'network-only',
    }
  );

  const [markAsReadMutation] = useMutation(MARK_READ_MUTATION, {
    refetchQueries: ['GetBudgetNotifications'],
  });

  const notifications = useMemo(() => data?.budgetNotifications ?? [], [data?.budgetNotifications]);

  // Show first unread notification
  useEffect(() => {
    if (notifications.length > 0 && !currentNotification) {
      const firstNotification = notifications[0];
      if (firstNotification && !processedNotificationIds.current.has(firstNotification.id)) {
        setCurrentNotification(firstNotification);
        setOpen(true);
        processedNotificationIds.current.add(firstNotification.id);
      }
    }
  }, [notifications, currentNotification]);

  // Clean up processed IDs when notification is marked as read
  useEffect(() => {
    if (!currentNotification && !open) {
      // Reset processed IDs periodically to allow re-showing if needed
      // This prevents memory growth from processed IDs
      // Reduced threshold from 100 to 50 for more aggressive cleanup
      if (processedNotificationIds.current.size > 50) {
        processedNotificationIds.current.clear();
      }
    }
  }, [currentNotification, open]);

  const showNotification = useCallback((notification: BudgetNotification): void => {
    setCurrentNotification(notification);
    setOpen(true);
  }, []);

  const markAsRead = useCallback(
    async (id: string): Promise<void> => {
      try {
        await markAsReadMutation({
          variables: { id },
        });
        setOpen(false);
        setCurrentNotification(null);
        processedNotificationIds.current.delete(id);
        void refetch();
      } catch (error) {
        // Log error for debugging
        console.error('Failed to mark notification as read:', error);
        // Show user-friendly error message
        const userMessage = getUserFriendlyErrorMessage(error);
        setErrorMessage(userMessage);
        setErrorOpen(true);
        // Still close the notification to prevent UI blocking
        setOpen(false);
        setCurrentNotification(null);
      }
    },
    [markAsReadMutation, refetch]
  );

  const handleClose = useCallback(
    (_event?: React.SyntheticEvent | Event, reason?: string): void => {
      if (reason === 'clickaway') {
        return;
      }
      if (currentNotification) {
        void markAsRead(currentNotification.id);
      }
    },
    [currentNotification, markAsRead]
  );

  // Auto-dismiss after configured timeout
  useEffect(() => {
    if (open && currentNotification) {
      const timer = setTimeout(() => {
        void markAsRead(currentNotification.id);
      }, NOTIFICATION_AUTO_DISMISS_MS);
      return (): void => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [open, currentNotification, markAsRead]);

  const handleErrorClose = useCallback(
    (_event?: React.SyntheticEvent | Event, reason?: string): void => {
      if (reason === 'clickaway') {
        return;
      }
      setErrorOpen(false);
      setErrorMessage(null);
    },
    []
  );

  const showSuccessNotification = useCallback((message: string): void => {
    setSuccessMessage(message);
    setSuccessOpen(true);
  }, []);

  const showErrorNotification = useCallback((message: string): void => {
    setErrorMessage(message);
    setErrorOpen(true);
  }, []);

  const handleSuccessClose = useCallback(
    (_event?: React.SyntheticEvent | Event, reason?: string): void => {
      if (reason === 'clickaway') {
        return;
      }
      setSuccessOpen(false);
      setSuccessMessage(null);
    },
    []
  );

  // Listen to error events from errorNotification utility
  useEffect(() => {
    const handleError = (event: Event): void => {
      const customEvent = event as CustomEvent<{ message: string; details?: unknown }>;
      if (customEvent.detail?.message) {
        setErrorMessage(customEvent.detail.message);
        setErrorOpen(true);
      }
    };

    window.addEventListener('app-error', handleError);
    return (): void => {
      window.removeEventListener('app-error', handleError);
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        showNotification,
        markAsRead,
        showSuccessNotification,
        showErrorNotification,
      }}
    >
      {children}
      <Snackbar
        open={open}
        autoHideDuration={NOTIFICATION_AUTO_DISMISS_MS}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleClose} severity="warning" sx={{ width: '100%' }}>
          {currentNotification?.message}
        </Alert>
      </Snackbar>
      <Snackbar
        open={errorOpen}
        autoHideDuration={NOTIFICATION_AUTO_DISMISS_MS}
        onClose={handleErrorClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          // Ensure notifications don't overlap
          zIndex: (theme) => theme.zIndex.snackbar,
        }}
      >
        <Alert
          onClose={handleErrorClose}
          severity="error"
          sx={{
            width: '100%',
            maxWidth: { xs: '90vw', sm: '400px' },
            // Add elevation for better visibility
            boxShadow: 3,
          }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>
      <Snackbar
        open={successOpen}
        autoHideDuration={NOTIFICATION_AUTO_DISMISS_MS}
        onClose={handleSuccessClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          // Ensure notifications don't overlap
          zIndex: (theme) => theme.zIndex.snackbar,
        }}
      >
        <Alert
          onClose={handleSuccessClose}
          severity="success"
          sx={{
            width: '100%',
            maxWidth: { xs: '90vw', sm: '400px' },
            // Add elevation for better visibility
            boxShadow: 3,
          }}
        >
          {successMessage}
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
