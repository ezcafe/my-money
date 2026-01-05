/**
 * Apollo Client Configuration
 * Apollo Client v4 - Following migration guide: https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration
 */

import {ApolloClient, InMemoryCache, HttpLink, from, type ApolloLink, type FetchResult, Observable} from '@apollo/client';
import {setContext} from '@apollo/client/link/context';
import {onError} from '@apollo/client/link/error';
import {ApolloLink as ApolloLinkClass} from '@apollo/client';
import {ensureValidToken, refreshToken} from '../utils/tokenRefresh';
import {getEncryptedToken} from '../utils/tokenEncryption';
import {uploadLink} from './uploadLink';
import {CONNECTION_ERROR_THROTTLE_MS, APOLLO_CACHE_MAX_SIZE, CIRCUIT_BREAKER_FAILURE_THRESHOLD, CIRCUIT_BREAKER_COOLDOWN_MS} from '../utils/constants';
import {showErrorNotification, getUserFriendlyErrorMessage} from '../utils/errorNotification';
import {API_CONFIG} from '../config/api';

/**
 * Custom fetch function with timeout support
 * @param input - Request URL or RequestInfo
 * @param options - Fetch options
 * @returns Promise<Response>
 */
function fetchWithTimeout(input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const timeout = API_CONFIG.requestTimeoutMs;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  return fetch(input, {
    ...options,
    signal: controller.signal,
  })
    .then((response) => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch((error: unknown) => {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    });
}

// Circuit breaker state for connection errors
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

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
function recordSuccess(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

// Note: Using process.env for Webpack compatibility
// For ESM 2025, would need DefinePlugin configuration in webpack.config.ts
// Apollo Client v4: Use HttpLink class directly instead of createHttpLink
//
// REQUEST BATCHING: Apollo Client v4 automatically deduplicates identical queries
// executed within a short time window. For explicit batching of multiple queries,
// consider using Apollo Client's query batching feature or implement a custom link.
// The current implementation benefits from automatic deduplication.
const httpLink = new HttpLink({
  uri: API_CONFIG.graphqlUrl,
  // Use custom fetch with timeout support
  fetch: fetchWithTimeout,
  // Apollo Client v4 automatically deduplicates requests
  // Additional batching can be configured here if needed
});

// Auth link to add token to requests
// Automatically refreshes token if expired or about to expire
const authLink = setContext(async (_request, prevContext) => {
  const prevHeaders = prevContext.headers && typeof prevContext.headers === 'object' ? prevContext.headers as Record<string, string> : {};
  const headers: Record<string, string> = {...prevHeaders};
  // Get token from storage (encrypted, will be set after OIDC login)
  let token: string | null = await getEncryptedToken('oidc_token');

  // Ensure token is valid (refresh if needed)
  if (token) {
    token = await ensureValidToken(token);
  }

  return {
    ...prevContext,
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// Error link with enhanced error handling and token refresh
const errorLink = onError((options) => {
  const {graphQLErrors, networkError} = options as {graphQLErrors?: Array<{message: string; locations?: unknown; path?: unknown; extensions?: unknown}>; networkError?: Error & {statusCode?: number}};

  // Check circuit breaker before processing errors
  if (networkError && isCircuitOpen()) {
    const errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
    if (errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('Failed to fetch')) {
      const userMessage = 'Server is temporarily unavailable. Please try again in a moment.';
      showErrorNotification(userMessage, {originalError: errorMessage, circuitOpen: true});
      return;
    }
  }

  // Handle GraphQL errors
  if (graphQLErrors) {
    for (const {message, locations, path, extensions} of graphQLErrors) {
      // Handle authentication errors
      const extensionsObj = extensions && typeof extensions === 'object' ? extensions as Record<string, unknown> : null;
      const statusCode = extensionsObj && 'statusCode' in extensionsObj ? extensionsObj.statusCode : undefined;
      const code = extensionsObj && 'code' in extensionsObj ? extensionsObj.code : undefined;
      if (code === 'UNAUTHORIZED' || (typeof statusCode === 'number' && statusCode === 401)) {
        // Attempt to refresh token before giving up
        void getEncryptedToken('oidc_token').then((currentToken) => {
          if (currentToken) {
          // Try to refresh token asynchronously
          // Note: Apollo Client will automatically retry with the new token
          // from authLink on the next request
            void refreshToken()
            .then((newToken) => {
              if (newToken) {
                console.warn('Token refreshed successfully');
              } else {
                // Refresh failed, clear and require re-auth
                localStorage.removeItem('oidc_token');
                localStorage.removeItem('oidc_refresh_token');
                console.error('Token refresh failed - please login again');
              }
            })
            .catch(() => {
              localStorage.removeItem('oidc_token');
              localStorage.removeItem('oidc_refresh_token');
              console.error('Token refresh error - please login again');
            });
          } else {
            // No token available, require re-auth
            localStorage.removeItem('oidc_refresh_token');
            console.error('Unauthorized - please login again');
          }
        });
        return;
      }

      // Log other errors
      const locationsStr = locations ? JSON.stringify(locations) : 'unknown';
      const pathStr = path ? JSON.stringify(path) : 'unknown';
      console.error(`GraphQL error: Message: ${message}, Location: ${locationsStr}, Path: ${pathStr}`);
    }
  }

  // Handle network errors
  if (networkError) {
    const networkStatusCode = 'statusCode' in networkError && typeof (networkError as {statusCode?: number}).statusCode === 'number' ? (networkError as {statusCode: number}).statusCode : undefined;
    if (networkStatusCode === 401) {
      // Attempt token refresh on 401
      void getEncryptedToken('oidc_token').then((currentToken) => {
        if (currentToken) {
          void refreshToken()
            .then((newToken) => {
              if (newToken) {
                console.warn('Token refreshed after network error');
              } else {
                // Refresh failed, clear tokens
                localStorage.removeItem('oidc_token');
                localStorage.removeItem('oidc_refresh_token');
                console.error('Network unauthorized - please login again');
              }
            })
            .catch(() => {
              localStorage.removeItem('oidc_token');
              localStorage.removeItem('oidc_refresh_token');
              console.error('Network unauthorized - please login again');
            });
        } else {
          localStorage.removeItem('oidc_refresh_token');
          console.error('Network unauthorized - please login again');
        }
      });
    } else {
      // Handle connection errors more gracefully
      const errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
      const isConnectionError = errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('Failed to fetch');

      if (isConnectionError) {
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
  }
});

// Logging link for development mode
const loggingLink = new ApolloLinkClass((operation, forward) => {
  // Only log in development mode
  if (process.env.NODE_ENV === 'development') {
    const operationName = operation.operationName ?? 'Unknown';
    const variables = operation.variables;

    // Sanitize variables for logging (remove sensitive data)
    const sanitizedVariables: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(variables)) {
      // Don't log file objects or sensitive fields
      if (value instanceof File) {
        sanitizedVariables[key] = `[File: ${value.name}, ${value.size} bytes]`;
      } else if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
        sanitizedVariables[key] = '[REDACTED]';
      } else {
        sanitizedVariables[key] = value;
      }
    }

    // Try to get query string for logging
    let queryPreview = 'N/A';
    try {
      if (operation.query.loc?.source?.body) {
        const body = operation.query.loc.source.body;
        queryPreview = `${body.substring(0, 200)}...`;
      }
    } catch {
      // Ignore errors when accessing query location
    }

    // eslint-disable-next-line no-console
    console.log(`[GraphQL Request] ${operationName}`, {
      operation: operationName,
      variables: sanitizedVariables,
      query: queryPreview,
    });

    return new Observable<FetchResult>((observer) => {
      const subscription = forward(operation).subscribe({
        next: (response: FetchResult) => {
          // eslint-disable-next-line no-console
          console.log(`[GraphQL Response] ${operationName}`, {
            operation: operationName,
            data: response.data,
            errors: response.errors,
          });
          observer.next(response);
        },
        error: (error: unknown) => {
          observer.error(error);
        },
        complete: () => {
          observer.complete();
        },
      });
      return (): void => {
        subscription.unsubscribe();
      };
    });
  }

  // In production, just forward without logging
  return forward(operation);
});

// Success tracking link to reset circuit breaker on successful requests
const successTrackingLink = new ApolloLinkClass((operation, forward) => {
  return new Observable<FetchResult>((observer) => {
    const subscription = forward(operation).subscribe({
      next: (response: FetchResult) => {
        // Record success to reset circuit breaker
        recordSuccess();
        observer.next(response);
      },
      error: (error: unknown) => {
        observer.error(error);
      },
      complete: () => {
        observer.complete();
      },
    });
    return (): void => {
      subscription.unsubscribe();
    };
  });
});

/**
 * Apollo Client instance
 * Configured according to Apollo Client v4 best practices
 */
// Create cache with monitoring for size limits
const cache = new InMemoryCache({
    typePolicies: {
      Account: {
        fields: {
          balance: {
            // Balance is computed, read from cache if available
            read(existing: number | undefined): number {
              return existing ?? 0;
            },
          },
        },
      },
      Transaction: {
        keyFields: ['id'],
      },
      Query: {
        fields: {
          transactions: {
            // Merge paginated results
            // Apollo Client v4: merge function signature remains the same
            merge(
              existing: {items: unknown[]; totalCount: number; hasMore: boolean} = {items: [], totalCount: 0, hasMore: false},
              incoming: {items?: unknown[]; totalCount?: number; hasMore?: boolean},
            ): {items: unknown[]; totalCount: number; hasMore: boolean} {
              return {
                items: [...(existing.items ?? []), ...(incoming.items ?? [])],
                totalCount: incoming.totalCount ?? existing.totalCount,
                hasMore: incoming.hasMore ?? existing.hasMore,
              };
            },
          },
          reportTransactions: {
            // Don't merge report results, always use fresh data
            merge: false,
          },
        },
      },
    },
    // Apollo Client v4: possibleTypes can be configured here if needed for union/interface types
    // possibleTypes: {},
  });

// Track cache access times for LRU eviction
// Maps cache key to last access timestamp
const cacheAccessTimes = new Map<string, number>();

// Monitor and evict cache entries if size exceeds limit
// Uses LRU (Least Recently Used) strategy based on access times
function evictCacheIfNeeded(): void {
  try {
    const cacheData = cache.extract();
    const cacheKeys = Object.keys(cacheData);
    const now = Date.now();

    // Update access times for current cache keys (mark as recently seen)
    for (const key of cacheKeys) {
      if (!cacheAccessTimes.has(key)) {
        // New key - set current time
        cacheAccessTimes.set(key, now);
      }
    }

    // Remove access times for keys that no longer exist in cache
    for (const key of cacheAccessTimes.keys()) {
      if (!cacheKeys.includes(key)) {
        cacheAccessTimes.delete(key);
      }
    }

    // If cache exceeds max size, evict least recently used entries
    if (cacheKeys.length > APOLLO_CACHE_MAX_SIZE) {
      // Sort by access time (oldest first) - true LRU
      const entries = Array.from(cacheAccessTimes.entries())
        .filter(([key]) => cacheKeys.includes(key))
        .sort((a, b) => a[1] - b[1]);

      // Evict oldest entries (least recently used)
      const keysToEvict = entries
        .slice(0, cacheKeys.length - APOLLO_CACHE_MAX_SIZE)
        .map(([key]) => key);

      for (const key of keysToEvict) {
        try {
          cache.evict({id: key});
          cacheAccessTimes.delete(key);
        } catch {
          // Ignore eviction errors for individual keys
        }
      }
      cache.gc(); // Garbage collect evicted entries
    }
  } catch (error) {
    // Silently handle cache monitoring errors
    console.warn('Cache eviction check failed:', error);
  }
}

// Update access time when cache is read
// Hook into cache reads by wrapping the cache's readQuery method
const originalReadQuery = cache.readQuery.bind(cache);
(cache as {readQuery: typeof cache.readQuery}).readQuery = function(
  options: Parameters<typeof cache.readQuery>[0],
): ReturnType<typeof cache.readQuery> {
  const result = originalReadQuery(options);
  // Update access times for all current cache keys after a read
  // This approximates LRU by tracking when cache is accessed
  const cacheData = cache.extract();
  const now = Date.now();
  for (const key of Object.keys(cacheData)) {
    cacheAccessTimes.set(key, now);
  }
  return result;
};

// Set up periodic cache eviction check (every 5 minutes)
// Store interval ID for cleanup
let cacheEvictionIntervalId: ReturnType<typeof setInterval> | null = null;

if (typeof window !== 'undefined') {
  cacheEvictionIntervalId = setInterval(evictCacheIfNeeded, 5 * 60 * 1000);

  // Clean up interval on page unload
  window.addEventListener('beforeunload', () => {
    if (cacheEvictionIntervalId !== null) {
      clearInterval(cacheEvictionIntervalId);
      cacheEvictionIntervalId = null;
    }
  });
}

export const client = new ApolloClient({
  link: from([loggingLink, errorLink, authLink, uploadLink, successTrackingLink, httpLink] as ApolloLink[]),
  cache,
  defaultOptions: {
    // Use cache-first for watchQuery to avoid unnecessary network requests
    // Components that need real-time data can override this per-query
    watchQuery: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});


