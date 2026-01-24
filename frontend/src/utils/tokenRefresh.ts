/**
 * Token Refresh Utility
 * Handles OIDC token refresh using backend endpoint
 * Tokens are stored in httpOnly cookies for enhanced security
 */

import {
  TOKEN_EXPIRATION_BUFFER_SECONDS,
  TOKEN_REFRESH_MAX_RETRY_ATTEMPTS,
  TOKEN_REFRESH_INITIAL_RETRY_DELAY_MS,
} from './constants';

/**
 * Flag to prevent multiple simultaneous redirects
 */
let isRedirecting = false;

/**
 * Promise for ongoing token refresh to prevent concurrent refresh attempts
 */
let refreshPromise: Promise<string | null> | null = null;

/**
 * Decode JWT token to extract claims
 * @param token - JWT token string
 * @returns Decoded token payload or null if invalid
 */
export function decodeToken(token: string): { exp?: number; iat?: number; sub?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    if (!payload) {
      return null;
    }
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
      iat?: number;
      sub?: string;
    };
    return decoded;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Check if token is expired or will expire soon
 * @param token - JWT token string
 * @param bufferSeconds - Buffer time in seconds before expiration (default: TOKEN_EXPIRATION_BUFFER_SECONDS)
 * @returns true if token is expired or will expire soon
 */
export function isTokenExpired(
  token: string,
  bufferSeconds: number = TOKEN_EXPIRATION_BUFFER_SECONDS
): boolean {
  const decoded = decodeToken(token);
  if (!decoded?.exp) {
    return true; // Consider invalid tokens as expired
  }

  const expirationTime = decoded.exp * 1000; // Convert to milliseconds
  const bufferTime = bufferSeconds * 1000;
  const now = Date.now();

  return now >= expirationTime - bufferTime;
}

/**
 * Get token expiration time
 * @param token - JWT token string
 * @returns Expiration timestamp in milliseconds, or null if invalid
 */
export function getTokenExpiration(token: string): number | null {
  const decoded = decodeToken(token);
  if (!decoded?.exp) {
    return null;
  }

  return decoded.exp * 1000; // Convert to milliseconds
}

/**
 * Check if an error is retryable (network errors, timeouts, etc.)
 * @param error - Error to check
 * @returns true if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on network errors, timeouts, and connection issues
    const retryablePatterns = [
      /failed to fetch/i,
      /networkerror/i,
      /timeout/i,
      /econnrefused/i,
      /etimedout/i,
      /enotfound/i,
      /connection/i,
    ];
    return retryablePatterns.some((pattern) => pattern.test(message));
  }
  // For non-Error objects, check if it's a network-related error
  if (typeof error === 'string') {
    return /network|timeout|connection|fetch/i.test(error.toLowerCase());
  }
  return false;
}

/**
 * Internal function to perform the actual token refresh
 * Uses backend refresh endpoint which handles token refresh and updates httpOnly cookies
 * Throws errors for retryable failures, returns null for non-retryable failures
 * @returns Token string (always returns a placeholder since cookies are used) or null if refresh failed
 * @throws Error for retryable failures (network errors, timeouts)
 */
async function performTokenRefresh(): Promise<string | null> {
  try {
    // Call backend refresh endpoint
    // Backend will use refresh token from cookie and update access token cookie
    const backendUrl =
      process.env.REACT_APP_GRAPHQL_URL?.replace('/graphql', '') ?? 'http://localhost:4000';
    const refreshUrl = `${backendUrl}/auth/refresh`;

    let response: Response;
    try {
      response = await fetch(refreshUrl, {
        method: 'POST',
        credentials: 'include', // Include cookies
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error: unknown) {
      // Network errors are retryable
      if (isRetryableError(error)) {
        throw error;
      }
      console.error('Unexpected error during token refresh:', error);
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorDetails: unknown;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }

      console.error('Token refresh failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
        possibleReasons: [
          'Refresh token has expired',
          'Refresh token was revoked',
          'Invalid refresh token',
          'OIDC provider configuration issue',
        ],
      });

      // If refresh token is invalid, redirect to login
      if (response.status === 400 || response.status === 401) {
        console.warn('Token refresh failed, redirecting to login');
        // Only redirect if we're not already on the login page and not already redirecting
        if (
          !isRedirecting &&
          window.location.pathname !== '/login' &&
          window.location.pathname !== '/auth/callback'
        ) {
          isRedirecting = true;
          window.location.href = '/login';
        }
      }

      // 5xx errors might be retryable (server errors)
      if (response.status >= 500 && response.status < 600) {
        throw new Error(`Token refresh server error: ${response.status}`);
      }

      return null;
    }

    // Token refresh successful - cookies are updated by backend
    // Return a placeholder token string since we don't have direct access to the cookie value
    // The actual token is in the httpOnly cookie and will be sent automatically with requests
    return 'cookie-based-token';
  } catch (error) {
    // Re-throw retryable errors
    if (isRetryableError(error)) {
      throw error;
    }
    console.error('Error refreshing token:', error);
    return null;
  }
}

/**
 * Perform token refresh with exponential backoff retry logic
 * @param attempt - Current retry attempt (starts at 1)
 * @returns New token string or null if refresh failed after all retries
 */
async function performTokenRefreshWithRetry(attempt = 1): Promise<string | null> {
  try {
    return await performTokenRefresh();
  } catch (error) {
    // Only retry if error is retryable and we haven't exceeded max attempts
    if (attempt < TOKEN_REFRESH_MAX_RETRY_ATTEMPTS && isRetryableError(error)) {
      const delay = TOKEN_REFRESH_INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`Token refresh attempt ${attempt} failed, retrying in ${delay}ms...`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return performTokenRefreshWithRetry(attempt + 1);
    }
    // All retries exhausted or non-retryable error
    console.error(`Token refresh failed after ${attempt} attempt(s):`, error);
    return null;
  }
}

/**
 * Attempt to refresh the token using OIDC client
 * This function prevents concurrent refresh attempts by queuing requests
 * Implements exponential backoff retry logic for retryable errors
 * @returns New token string or null if refresh failed
 */
export async function refreshToken(): Promise<string | null> {
  // If a refresh is already in progress, wait for it instead of starting a new one
  if (refreshPromise) {
    return refreshPromise;
  }

  // Start a new refresh with retry logic
  refreshPromise = performTokenRefreshWithRetry().finally(() => {
    // Clear the promise when done so future refreshes can proceed
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Check token and refresh if needed
 * With cookie-based auth, we can't directly check token expiration
 * Instead, we rely on the backend to validate tokens and return 401 if expired
 * This function is kept for compatibility but doesn't perform token validation
 * @param token - Current token string (ignored for cookie-based auth)
 * @returns Token placeholder or null if refresh failed
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function ensureValidToken(token: string | null): Promise<string | null> {
  // With cookie-based auth, tokens are in httpOnly cookies
  // We can't check expiration directly, so we return a placeholder
  // The backend will validate the token and return 401 if expired
  // The error handler will then trigger a refresh
  return token ? 'cookie-based-token' : null;
}
