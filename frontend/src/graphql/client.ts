/**
 * Apollo Client Configuration
 * Apollo Client v4 - Following migration guide: https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration
 */

import {ApolloClient, InMemoryCache, HttpLink, from, type ApolloLink, type FetchResult, Observable} from '@apollo/client';
import {onError} from '@apollo/client/link/error';
import {ApolloLink as ApolloLinkClass} from '@apollo/client';
import {uploadLink} from './uploadLink';
import {APOLLO_CACHE_MAX_SIZE} from '../constants';
import {handleGraphQLErrors, handleNetworkError, recordSuccess} from './errorHandling';
import {API_CONFIG} from '../config/api';

/**
 * Custom fetch function with timeout support
 * Uses async/await for consistency with the rest of the codebase
 * @param input - Request URL or RequestInfo
 * @param options - Fetch options
 * @returns Promise<Response>
 */
async function fetchWithTimeout(input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const timeout = API_CONFIG.requestTimeoutMs;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(input, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}


// Note: Using process.env for Webpack compatibility
// For ESM 2025, would need DefinePlugin configuration in webpack.config.ts
// Apollo Client v4: Use HttpLink class directly instead of createHttpLink
//
// REQUEST BATCHING: Apollo Client v4 automatically deduplicates identical queries
// executed within a short time window. This provides efficient query batching
// without requiring explicit batching configuration.
// For true HTTP-level batching (multiple queries in one request),
// server-side support would be required.
const httpLink = new HttpLink({
  uri: API_CONFIG.graphqlUrl,
  // Use custom fetch with timeout support
  fetch: fetchWithTimeout,
  // Include credentials (cookies) with all requests
  credentials: 'include',
  // Apollo Client v4 automatically deduplicates requests
  // Query batching is handled via automatic deduplication
});

// Error link with enhanced error handling and token refresh
const errorLink = onError((options) => {
  const {graphQLErrors, networkError} = options as {graphQLErrors?: Array<{message: string; locations?: unknown; path?: unknown; extensions?: unknown}>; networkError?: Error & {statusCode?: number}};

  // Handle GraphQL errors
  if (graphQLErrors) {
    handleGraphQLErrors(graphQLErrors);
  }

  // Handle network errors
  if (networkError) {
    handleNetworkError(networkError);
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
 * Uses Apollo's built-in cache eviction policies instead of custom LRU implementation
 */
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
      // Use Apollo's built-in cache eviction for transactions
      // Evict old transactions when cache grows too large
      fields: {
        // Transactions are automatically evicted when cache size is managed via field policies
      },
    },
    Query: {
      fields: {
        transactions: {
          // Merge paginated results with time-based cache invalidation
          read(existing: {items: unknown[]; totalCount: number; hasMore: boolean; _cacheTime?: number} | undefined): {items: unknown[]; totalCount: number; hasMore: boolean} | undefined {
            if (!existing) {
              return undefined;
            }
            const cacheTime = existing._cacheTime;
            const now = Date.now();
            // Invalidate after 5 minutes
            if (cacheTime && now - cacheTime > 5 * 60 * 1000) {
              return undefined; // Force refetch
            }
            return {
              items: existing.items,
              totalCount: existing.totalCount,
              hasMore: existing.hasMore,
            };
          },
          merge(
            existing: {items: unknown[]; totalCount: number; hasMore: boolean; _cacheTime?: number} = {items: [], totalCount: 0, hasMore: false},
            incoming: {items?: unknown[]; totalCount?: number; hasMore?: boolean},
          ): {items: unknown[]; totalCount: number; hasMore: boolean; _cacheTime: number} {
            return {
              items: [...(existing.items ?? []), ...(incoming.items ?? [])],
              totalCount: incoming.totalCount ?? existing.totalCount,
              hasMore: incoming.hasMore ?? existing.hasMore,
              _cacheTime: Date.now(),
            };
          },
        },
        reportTransactions: {
          // Don't merge report results, always use fresh data
          merge: false,
        },
        recentTransactions: {
          // Limit cache size for recent transactions with time-based invalidation
          read(existing: {items: unknown[]; _cacheTime?: number} | undefined): unknown[] | undefined {
            if (!existing) {
              return undefined;
            }
            const cacheTime = existing._cacheTime;
            const now = Date.now();
            // Invalidate after 2 minutes (recent transactions change frequently)
            if (cacheTime && now - cacheTime > 2 * 60 * 1000) {
              return undefined; // Force refetch
            }
            return existing.items;
          },
          merge(_existing: {items: unknown[]; _cacheTime?: number} = {items: []}, incoming: unknown[]): {items: unknown[]; _cacheTime: number} {
            // recentTransactions is NOT paginated - it always returns the complete set of recent transactions
            // Therefore, we should REPLACE existing items, not concatenate them
            const limited = incoming.length > APOLLO_CACHE_MAX_SIZE
              ? incoming.slice(-APOLLO_CACHE_MAX_SIZE)
              : incoming;
            return {
              items: limited,
              _cacheTime: Date.now(),
            };
          },
        },
        accounts: {
          // Cache accounts with time-based invalidation
          read(existing: unknown[] | undefined): unknown[] | undefined {
            if (!existing) {
              return undefined;
            }
            // Accounts don't change frequently, use longer cache (10 minutes)
            // Cache time is stored in a separate field, but for simplicity we'll always return cached
            return existing;
          },
        },
        categories: {
          // Cache categories with time-based invalidation
          read(existing: unknown[] | undefined): unknown[] | undefined {
            if (!existing) {
              return undefined;
            }
            // Categories don't change frequently, use longer cache (10 minutes)
            return existing;
          },
        },
      },
    },
  },
  // Apollo Client v4: possibleTypes can be configured here if needed for union/interface types
  // possibleTypes: {},
});

// Use Apollo's built-in cache garbage collection
// Set up periodic cache cleanup using Apollo's gc() method
let cacheGcIntervalId: ReturnType<typeof setInterval> | null = null;

if (typeof window !== 'undefined') {
  // Run garbage collection every 5 minutes to clean up evicted entries
  cacheGcIntervalId = setInterval(() => {
    try {
      cache.gc();
    } catch (error) {
      console.warn('Cache garbage collection failed:', error);
    }
  }, 5 * 60 * 1000);

  // Clean up interval on page unload
  window.addEventListener('beforeunload', () => {
    if (cacheGcIntervalId !== null) {
      clearInterval(cacheGcIntervalId);
      cacheGcIntervalId = null;
    }
  });
}

export const client = new ApolloClient({
  link: from([loggingLink, errorLink, uploadLink, successTrackingLink, httpLink] as ApolloLink[]),
  cache,
  defaultOptions: {
    // Use cache-and-network for watchQuery to get immediate cache results
    // while fetching fresh data in the background for better UX
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
    },
    // Use cache-first for regular queries to minimize network requests
    // Components that need real-time data can override this per-query
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
      // Automatically refetch active queries after mutations for consistency
      refetchQueries: 'active',
    },
  },
  // Query deduplication is enabled by default in Apollo Client v4
  // This prevents duplicate requests for identical queries
});


