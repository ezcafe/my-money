/**
 * API-related constants
 * Configuration for API requests, timeouts, retries, and caching
 */

/**
 * Token expiration buffer time in seconds (refresh token before it expires)
 */
export const TOKEN_EXPIRATION_BUFFER_SECONDS = 60;

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
