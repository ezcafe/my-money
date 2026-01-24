/**
 * Application constants
 * Shared constants used across the application
 */

/**
 * Maximum file size for PDF uploads (10MB)
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Allowed file types for PDF uploads
 */
export const ALLOWED_FILE_TYPES = ['application/pdf'];

/**
 * Default currency code
 */
export const DEFAULT_CURRENCY = 'USD';

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
 * Token expiration buffer time in seconds (refresh token before it expires)
 */
export const TOKEN_EXPIRATION_BUFFER_SECONDS = 60;

/**
 * Auto-dismiss timeout for notifications in milliseconds (5 seconds)
 */
export const NOTIFICATION_AUTO_DISMISS_MS = 5000;

/**
 * Connection error logging throttle interval in milliseconds (5 seconds)
 */
export const CONNECTION_ERROR_THROTTLE_MS = 5000;

/**
 * Apollo cache maximum size (number of objects)
 */
export const APOLLO_CACHE_MAX_SIZE = 1000;

/**
 * Service worker cache maximum size in MB
 */
export const SERVICE_WORKER_CACHE_MAX_SIZE_MB = 50;

/**
 * Token refresh retry configuration
 */
export const TOKEN_REFRESH_MAX_RETRY_ATTEMPTS = 3;
export const TOKEN_REFRESH_INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Circuit breaker configuration for connection errors
 */
export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
export const CIRCUIT_BREAKER_COOLDOWN_MS = 30000; // 30 seconds

/**
 * GraphQL request timeout in milliseconds (30 seconds)
 */
export const GRAPHQL_REQUEST_TIMEOUT_MS = 30000;
