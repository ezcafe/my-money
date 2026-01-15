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
 * Responsive breakpoint constants (Material Design 3)
 * Use these for consistent breakpoint values across the app
 */
export const RESPONSIVE_BREAKPOINTS = {
  xs: 0,      // Mobile
  sm: 600,    // Tablet
  md: 960,    // Desktop
  lg: 1280,   // Large Desktop
  xl: 1920,   // Extra Large Desktop
} as const;

/**
 * Note: For page containers, use the PageContainer component from
 * '../components/common/PageContainer' instead of inline styles.
 * It provides consistent nested container structure with responsive behavior.
 */
