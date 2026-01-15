/**
 * GraphQL Error Handling
 * Centralized error handling logic for Apollo Client
 */

import {refreshToken} from '../utils/tokenRefresh';
import {showErrorNotification, getUserFriendlyErrorMessage} from '../utils/errorNotification';
import {CONNECTION_ERROR_THROTTLE_MS} from '../constants';

/**
 * Circuit breaker state for connection errors
 */
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

/**
 * Circuit breaker configuration
 */
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000; // 30 seconds

/**
 * Check if circuit breaker is open (blocking requests)
 * @returns true if circuit is open and requests should be blocked
 */
function isCircuitOpen(): boolean {
  const now = Date.now();
  // If cooldown period has passed, reset
  if (now >= circuitOpenUntil && circuitOpenUntil > 0) {
    consecutiveFailures = 0;
    circuitOpenUntil = 0;
    return false;
  }
  // If circuit is in cooldown, it's open
  if (now < circuitOpenUntil) {
    return true;
  }
  // If failures exceed threshold, open circuit
  if (consecutiveFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    circuitOpenUntil = now + CIRCUIT_BREAKER_COOLDOWN_MS;
    return true;
  }
  return false;
}

/**
 * Record a connection failure
 */
function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
  }
}

/**
 * Record a successful connection (reset circuit breaker)
 */
export function recordSuccess(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

/**
 * GraphQL error structure
 */
interface GraphQLError {
  message: string;
  locations?: unknown;
  path?: unknown;
  extensions?: unknown;
}

/**
 * Network error structure
 */
interface NetworkError extends Error {
  statusCode?: number;
}

/**
 * Handle authentication errors (401, UNAUTHORIZED)
 * Attempts to refresh the token before requiring re-authentication
 */
async function handleAuthError(): Promise<void> {
  // With cookie-based auth, attempt to refresh token via backend
  try {
    const newToken = await refreshToken();
    if (newToken) {
      console.warn('Token refreshed successfully');
    } else {
      // Refresh failed, redirect to login
      console.error('Token refresh failed - please login again');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
        window.location.href = '/login';
      }
    }
  } catch {
    console.error('Token refresh error - please login again');
    if (window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
      window.location.href = '/login';
    }
  }
}

/**
 * Handle GraphQL errors with user-friendly messages and recovery strategies
 * @param graphQLErrors - Array of GraphQL errors
 */
export function handleGraphQLErrors(graphQLErrors: GraphQLError[]): void {
  for (const {message, locations, path, extensions} of graphQLErrors) {
    // Handle authentication errors
    const extensionsObj = extensions && typeof extensions === 'object' ? extensions as Record<string, unknown> : null;
    const statusCode = extensionsObj && 'statusCode' in extensionsObj ? extensionsObj.statusCode : undefined;
    const code = extensionsObj && 'code' in extensionsObj ? extensionsObj.code : undefined;

    if (code === 'UNAUTHORIZED' || (typeof statusCode === 'number' && statusCode === 401)) {
      // Attempt to refresh token before giving up
      void handleAuthError();
      return;
    }

    // Handle specific error codes with user-friendly messages
    const errorObj = new Error(message);
    if (extensionsObj) {
      Object.assign(errorObj, {extensions: extensionsObj});
    }
    let userMessage = getUserFriendlyErrorMessage(errorObj);
    let retryable = false;
    let retryAfter: number | undefined;

    switch (code) {
      case 'RATE_LIMIT_EXCEEDED':
        userMessage = 'Too many requests. Please wait a moment before trying again.';
        retryable = true;
        retryAfter = extensionsObj && typeof extensionsObj.retryAfter === 'number' ? extensionsObj.retryAfter : 60;
        break;
      case 'QUERY_TOO_COMPLEX':
      case 'QUERY_COST_EXCEEDED':
        userMessage = 'Query is too complex. Please simplify your request or try again later.';
        retryable = true;
        break;
      case 'QUERY_DEPTH_EXCEEDED':
        userMessage = 'Query depth exceeds limit. Please simplify your request.';
        retryable = false;
        break;
      case 'VALIDATION_ERROR':
      case 'BAD_USER_INPUT': {
        // Show field-specific validation errors
        const validationErrors = extensionsObj && 'validationErrors' in extensionsObj ? extensionsObj.validationErrors : undefined;
        if (validationErrors && Array.isArray(validationErrors)) {
          const fieldErrors = (validationErrors as Array<{path: Array<string | number>; message: string}>)
            .map((err) => `${err.path.join('.')}: ${err.message}`)
            .join(', ');
          userMessage = `Validation error: ${fieldErrors}`;
        } else {
          userMessage = `Validation error: ${message}`;
        }
        retryable = false;
        break;
      }
      case 'INPUT_SIZE_EXCEEDED':
        userMessage = 'Input size exceeds maximum limit. Please reduce the size of your input.';
        retryable = false;
        break;
      case 'NOT_FOUND':
        userMessage = `Resource not found: ${message}`;
        retryable = false;
        break;
      case 'FORBIDDEN':
        userMessage = 'You do not have permission to perform this action.';
        retryable = false;
        break;
      case 'INTERNAL_SERVER_ERROR':
        userMessage = 'An internal server error occurred. Please try again later.';
        retryable = true;
        break;
      case 'DATABASE_ERROR':
        userMessage = 'A database error occurred. Please try again later.';
        retryable = true;
        break;
      default:
        // Use default user-friendly message
        break;
    }

    // Show error notification with recovery options
    showErrorNotification(userMessage, {
      originalError: message,
      code: code as string | undefined,
      retryable,
      retryAfter,
      path: path ? JSON.stringify(path) : undefined,
    });

    // Log detailed error for debugging
    const locationsStr = locations ? JSON.stringify(locations) : 'unknown';
    const pathStr = path ? JSON.stringify(path) : 'unknown';
    let codeStr = 'unknown';
    if (code !== undefined) {
      if (typeof code === 'string') {
        codeStr = code;
      } else if (typeof code === 'object' && code !== null) {
        codeStr = JSON.stringify(code);
      } else if (typeof code === 'number' || typeof code === 'boolean' || typeof code === 'bigint') {
        codeStr = String(code);
      }
    }
    console.error(`GraphQL error: Message: ${message}, Location: ${locationsStr}, Path: ${pathStr}, Code: ${codeStr}`);
  }
}

/**
 * Handle network errors
 * @param networkError - Network error object
 */
export function handleNetworkError(networkError: NetworkError): void {
  const networkStatusCode = 'statusCode' in networkError && typeof (networkError as {statusCode?: number}).statusCode === 'number' ? (networkError as {statusCode: number}).statusCode : undefined;

  if (networkStatusCode === 401) {
    // Attempt token refresh on 401
    void handleAuthError();
    return;
  }

  // Handle connection errors more gracefully
  const errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
  const isConnectionError = errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('Failed to fetch');

  if (isConnectionError) {
    // Check circuit breaker before processing errors
    if (isCircuitOpen()) {
      const userMessage = 'Server is temporarily unavailable. Please try again in a moment.';
      showErrorNotification(userMessage, {originalError: errorMessage, circuitOpen: true});
      return;
    }

    // Record failure for circuit breaker
    recordFailure();

    // Backend is not running - show user-friendly error message
    // Only show once to avoid spam
    const lastConnectionError = sessionStorage.getItem('last_connection_error');
    const now = Date.now();
    if (!lastConnectionError || now - Number.parseInt(lastConnectionError, 10) > CONNECTION_ERROR_THROTTLE_MS) {
      const userMessage = getUserFriendlyErrorMessage(networkError);
      showErrorNotification(userMessage, {originalError: errorMessage});
      sessionStorage.setItem('last_connection_error', String(now));
    }
  } else {
    // Show user-friendly error message for other network errors
    const userMessage = getUserFriendlyErrorMessage(networkError);
    showErrorNotification(userMessage, {originalError: errorMessage});
  }
}
