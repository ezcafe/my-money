/**
 * UI-related constants
 * Configuration for user interface elements, pagination, and display settings
 */

/**
 * Items per page for pagination
 */
export const ITEMS_PER_PAGE = 20;

/**
 * Maximum number of recent transactions to display
 */
export const MAX_RECENT_TRANSACTIONS = 30;

/**
 * Notification polling interval in milliseconds (60 seconds)
 */
export const NOTIFICATION_POLL_INTERVAL_MS = 60 * 1000;

/**
 * Auto-dismiss timeout for notifications in milliseconds (5 seconds)
 */
export const NOTIFICATION_AUTO_DISMISS_MS = 5000;

/**
 * Default currency code
 */
export const DEFAULT_CURRENCY = 'USD';

/**
 * Minimum touch target size in pixels (WCAG 2.1 Level AAA recommendation)
 * Ensures interactive elements are easily tappable on mobile devices
 */
export const MIN_TOUCH_TARGET_SIZE = 44;

/**
 * Viewport configuration constants
 */
export const VIEWPORT_CONFIG = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
} as const;

/**
 * Page container style for consistent layout across all pages
 * - Mobile (xs): Full width
 * - Desktop/Tablet (sm+): Max 680px, centered
 */
export const pageContainerStyle = {
  width: {xs: '100%', sm: '100%'},
  maxWidth: {xs: '100%', sm: '680px'},
  mx: {xs: 0, sm: 'auto'},
} as const;
