/**
 * Error Notification Utility
 * Provides a way to show user-friendly error messages
 *
 * This utility integrates with the NotificationContext via a custom event system.
 * The NotificationProvider listens for 'app-error' events and displays them
 * using Material-UI Snackbar/Alert components.
 *
 * @see NotificationContext - Listens to 'app-error' events and displays notifications
 */

/**
 * Error notification details
 */
export interface ErrorNotificationDetails {
  originalError?: string;
  code?: string;
  retryable?: boolean;
  retryAfter?: number;
  path?: string;
  [key: string]: unknown;
}

/**
 * Show a user-friendly error message
 * Dispatches a custom 'app-error' event that is handled by NotificationContext,
 * which displays the error in a Snackbar/Alert component.
 *
 * @param message - Error message to display
 * @param details - Optional error details including retry information
 *
 * @example
 * ```typescript
 * showErrorNotification('Failed to save transaction');
 * showErrorNotification('Network error', {code: 'NETWORK_ERROR', retryable: true});
 * ```
 */
export function showErrorNotification(message: string, details?: ErrorNotificationDetails): void {
  // Log error for debugging
  console.error('Error notification:', message, details);

  // Dispatch custom event that NotificationContext listens to
  // The NotificationProvider (in NotificationContext.tsx) listens for 'app-error' events
  // and displays them using Material-UI Snackbar/Alert components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app-error', {
        detail: {message, details},
      }),
    );
  }
}

/**
 * Get user-friendly error message from error object
 * @param error - Error object or unknown
 * @returns User-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('failed to fetch') || message.includes('networkerror')) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }
    if (message.includes('connection refused')) {
      return 'The server is not available. Please try again later.';
    }

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('401')) {
      return 'Your session has expired. Please log in again.';
    }
    if (message.includes('forbidden') || message.includes('403')) {
      return 'You do not have permission to perform this action.';
    }

    // Server errors
    if (message.includes('500') || message.includes('internal server error')) {
      return 'A server error occurred. Please try again later.';
    }

    // Return original message if no specific match
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred. Please try again.';
}


