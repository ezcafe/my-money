/**
 * Apollo Client Configuration
 * Apollo Client v4 - Following migration guide: https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration
 */

import {ApolloClient, InMemoryCache, HttpLink, from, type ErrorLink, type ApolloLink} from '@apollo/client';
import {setContext} from '@apollo/client/link/context';
import {onError} from '@apollo/client/link/error';
import {ensureValidToken, refreshToken} from '../utils/tokenRefresh';

// Note: Using process.env for Webpack compatibility
// For ESM 2025, would need DefinePlugin configuration in webpack.config.ts
// Apollo Client v4: Use HttpLink class directly instead of createHttpLink
const httpLink = new HttpLink({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  uri: (process.env.REACT_APP_GRAPHQL_URL as string | undefined) ?? 'http://localhost:4000/graphql',
});

// Auth link to add token to requests
// Automatically refreshes token if expired or about to expire
const authLink = setContext(async (_request: unknown, {headers}: {headers?: Record<string, string>}): Promise<{headers: Record<string, string>}> => {
  // Get token from storage (will be set after OIDC login)
  let token: string | null = localStorage.getItem('oidc_token');
  
  // Ensure token is valid (refresh if needed)
  if (token) {
    token = await ensureValidToken(token);
  }
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// Error link with enhanced error handling and token refresh
const errorLink: ErrorLink = onError(({graphQLErrors, networkError}) => {
  // Handle GraphQL errors
  if (graphQLErrors) {
    for (const {message, locations, path, extensions} of graphQLErrors) {
      // Handle authentication errors
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const statusCode = extensions && typeof extensions === 'object' && 'statusCode' in extensions ? extensions.statusCode : undefined;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (extensions?.code === 'UNAUTHORIZED' || (typeof statusCode === 'number' && statusCode === 401)) {
        // Attempt to refresh token before giving up
        const currentToken = localStorage.getItem('oidc_token');
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
        return;
      }

      // Log other errors
      console.error(`GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`);
    }
  }

  // Handle network errors
  if (networkError) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const networkStatusCode = 'statusCode' in networkError && typeof networkError.statusCode === 'number' ? networkError.statusCode : undefined;
    if (networkStatusCode === 401) {
      // Attempt token refresh on 401
      const currentToken = localStorage.getItem('oidc_token');
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
    } else {
      console.error(`Network error: ${networkError}`);
    }
  }
});

/**
 * Apollo Client instance
 * Configured according to Apollo Client v4 best practices
 */
export const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink] as ApolloLink[]),
  cache: new InMemoryCache({
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
                ...incoming,
                items: [...(existing.items ?? []), ...(incoming.items ?? [])],
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
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
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


