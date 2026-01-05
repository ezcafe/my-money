/**
 * Error Notification Utility
 * Provides a way to show user-friendly error messages
 * Can be extended to integrate with notification system
 */

/**
 * Show a user-friendly error message
 * Currently logs to console, but can be extended to show UI notifications
 * @param message - Error message to display
 * @param details - Optional error details
 */
export function showErrorNotification(message: string, details?: unknown): void {
  // Log error for debugging
  console.error('Error notification:', message, details);

  // TODO: Integrate with notification system
  // For now, we rely on error boundaries and component-level error handling
  // To integrate with NotificationContext, we would need to:
  // 1. Create a global error notification store/event system
  // 2. Have NotificationProvider listen to error events
  // 3. Display errors via Snackbar/Alert component

  // Dispatch custom event that can be listened to by React components
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


