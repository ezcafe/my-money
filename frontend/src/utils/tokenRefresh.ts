/**
 * Token Refresh Utility
 * Handles OIDC token refresh and expiration checking
 *
 * SECURITY NOTE: Tokens are currently stored in localStorage, which is vulnerable to XSS attacks.
 * For production applications, consider:
 * 1. Using httpOnly cookies (requires backend changes to set cookies)
 * 2. Implementing token encryption before storing in localStorage
 * 3. Using secure storage mechanisms (e.g., Web Crypto API with encrypted storage)
 * 4. Implementing token rotation for enhanced security
 *
 * Current implementation uses localStorage for simplicity, but should be enhanced for production use.
 */

import {TOKEN_EXPIRATION_BUFFER_SECONDS, TOKEN_REFRESH_MAX_RETRY_ATTEMPTS, TOKEN_REFRESH_INITIAL_RETRY_DELAY_MS} from './constants';
import {storeEncryptedToken, getEncryptedToken} from './tokenEncryption';

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
export function decodeToken(token: string): {exp?: number; iat?: number; sub?: string} | null {
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
export function isTokenExpired(token: string, bufferSeconds: number = TOKEN_EXPIRATION_BUFFER_SECONDS): boolean {
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
 * Throws errors for retryable failures, returns null for non-retryable failures
 * @returns New token string or null if refresh failed (non-retryable)
 * @throws Error for retryable failures (network errors, timeouts)
 */
async function performTokenRefresh(): Promise<string | null> {
  try {
    // Get refresh token from storage (encrypted)
    const refreshTokenValue = await getEncryptedToken('oidc_refresh_token');
    if (!refreshTokenValue) {
      console.warn('No refresh token available for refresh. Possible reasons:', {
        reason: 'Refresh token not found in localStorage',
        possibleCauses: [
          'Refresh token was never stored during initial login (OIDC provider may not have returned one)',
          'Refresh token was cleared due to a previous error',
          'Refresh token expired and was cleared',
          'Missing "offline_access" scope in OIDC authorization request',
        ],
        action: 'User will need to re-authenticate',
      });
      // Clear all tokens and redirect to login page
      localStorage.removeItem('oidc_token');
      localStorage.removeItem('oidc_refresh_token');
      localStorage.removeItem('oidc_token_expiration');
      // Only redirect if we're not already on the login page and not already redirecting
      if (!isRedirecting && window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
        isRedirecting = true;
        window.location.href = '/login';
      }
      return null;
    }

    // Get OIDC configuration from environment
    const discoveryUrl: string | undefined = process.env.REACT_APP_OPENID_DISCOVERY_URL;
    const clientId: string | undefined = process.env.REACT_APP_OPENID_CLIENT_ID;

    if (!discoveryUrl || !clientId) {
      console.warn('OIDC configuration missing - token refresh not available');
      return null;
    }

    // Fetch token endpoint from discovery
    let discovery: {token_endpoint?: string};
    try {
      const discoveryResponse = await fetch(discoveryUrl ?? '');
      if (!discoveryResponse.ok) {
        console.error('Failed to fetch OIDC discovery document:', discoveryResponse.status);
        // Network errors are retryable, HTTP errors are not
        throw new Error(`Failed to fetch OIDC discovery document: ${discoveryResponse.status}`);
      }
      discovery = (await discoveryResponse.json()) as {token_endpoint?: string};
    } catch (error: unknown) {
      console.error('Error fetching OIDC discovery document:', error);
      // Re-throw retryable errors, return null for non-retryable
      if (isRetryableError(error)) {
        throw error;
      }
      return null;
    }

    if (!discovery.token_endpoint) {
      console.error('Token endpoint not found in discovery document');
      return null;
    }

    // Refresh the token
    const tokenEndpoint = discovery.token_endpoint;
    if (!tokenEndpoint) {
      console.error('Token endpoint not found in discovery document');
      return null;
    }

    let response: Response;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      response = await fetch(tokenEndpoint as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshTokenValue,
          client_id: clientId,
        }),
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

      // If refresh token is invalid, clear all tokens and redirect to login
      if (response.status === 400 || response.status === 401) {
        console.warn('Clearing invalid refresh token from storage');
        localStorage.removeItem('oidc_token');
        localStorage.removeItem('oidc_refresh_token');
        localStorage.removeItem('oidc_token_expiration');
        // Only redirect if we're not already on the login page and not already redirecting
        if (!isRedirecting && window.location.pathname !== '/login' && window.location.pathname !== '/auth/callback') {
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

    const tokenData = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
    } | null;

    // Store new tokens (encrypted)
    if (tokenData?.access_token) {
      await storeEncryptedToken('oidc_token', tokenData.access_token);
    }
    if (tokenData?.refresh_token) {
      await storeEncryptedToken('oidc_refresh_token', tokenData.refresh_token);
    }

    return tokenData?.access_token ?? null;
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
  refreshPromise = performTokenRefreshWithRetry()
    .finally(() => {
      // Clear the promise when done so future refreshes can proceed
      refreshPromise = null;
    });

  return refreshPromise;
}

/**
 * Check token and refresh if needed
 * @param token - Current token string
 * @returns Valid token string (refreshed if needed) or null if refresh failed
 */
export async function ensureValidToken(token: string | null): Promise<string | null> {
  if (!token) {
    return null;
  }

  // Check if token is expired or about to expire
  if (isTokenExpired(token)) {
    console.warn('Token expired or about to expire, attempting refresh...');
    const newToken = await refreshToken();
    if (newToken) {
      console.warn('Token refreshed successfully');
      return newToken;
    }
    // If refresh failed, refreshToken() will have already handled redirect to login
    // Return null to indicate token is invalid
    console.warn('Token refresh failed, user will need to re-authenticate');
    return null;
  }

  return token;
}

