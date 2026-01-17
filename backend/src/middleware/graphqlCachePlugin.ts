/**
 * GraphQL Response Caching Plugin
 * Caches GraphQL query responses using PostgreSQL cache
 * Cache key includes: query string, variables, and userId
 */

import type {ApolloServerPlugin, GraphQLRequestContext, GraphQLRequestListener} from '@apollo/server';
import type {GraphQLContext} from '../middleware/context';
import {createHash} from 'crypto';
import * as postgresCache from '../utils/postgresCache';
import {logInfo, logError} from '../utils/logger';

/**
 * Default cache TTL for queries (5 minutes)
 */
const DEFAULT_QUERY_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cache TTL for different query types
 */
const QUERY_CACHE_TTL: Record<string, number> = {
  // Reference data (accounts, categories, payees) - cache longer
  accounts: 10 * 60 * 1000, // 10 minutes
  categories: 10 * 60 * 1000, // 10 minutes
  payees: 10 * 60 * 1000, // 10 minutes
  preferences: 10 * 60 * 1000, // 10 minutes
  // Transaction queries - cache shorter
  transactions: 2 * 60 * 1000, // 2 minutes
  recentTransactions: 1 * 60 * 1000, // 1 minute
  // Reports - cache longer as they're expensive
  reportTransactions: 5 * 60 * 1000, // 5 minutes
};

/**
 * Generate cache key for GraphQL query
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @param userId - User ID for user-specific caching
 * @returns Cache key
 */
function generateCacheKey(query: string, variables: Record<string, unknown> | undefined, userId?: string): string {
  const queryHash = createHash('sha256').update(query).digest('hex');
  const variablesHash = variables
    ? createHash('sha256').update(JSON.stringify(variables)).digest('hex')
    : 'no-vars';
  const userPart = userId ? `:user:${userId}` : ':anonymous';
  return `graphql:query:${queryHash}:${variablesHash}${userPart}`;
}

/**
 * Determine cache TTL based on query operation name
 * @param query - GraphQL query string
 * @returns Cache TTL in milliseconds
 */
function getCacheTTL(query: string): number {
  // Extract operation name from query
  const operationMatch = query.match(/(?:query|mutation)\s+(\w+)/);
  if (operationMatch?.[1]) {
    const operationName = operationMatch[1];
    // Check if we have a specific TTL for this operation
    for (const [key, ttl] of Object.entries(QUERY_CACHE_TTL)) {
      if (operationName.toLowerCase().includes(key.toLowerCase()) && typeof ttl === 'number') {
        return ttl;
      }
    }
  }

  // Check query content for known patterns
  if (query.includes('accounts') && !query.includes('transactions')) {
    return QUERY_CACHE_TTL.accounts ?? 60;
  }
  if (query.includes('categories') && !query.includes('transactions')) {
    return QUERY_CACHE_TTL.categories ?? 60;
  }
  if (query.includes('payees') && !query.includes('transactions')) {
    return QUERY_CACHE_TTL.payees ?? 60;
  }
  if (query.includes('preferences')) {
    return QUERY_CACHE_TTL.preferences ?? 60;
  }
  if (query.includes('reportTransactions')) {
    return QUERY_CACHE_TTL.reportTransactions ?? 60;
  }
  if (query.includes('recentTransactions')) {
    return QUERY_CACHE_TTL.recentTransactions ?? 60;
  }
  if (query.includes('transactions')) {
    return QUERY_CACHE_TTL.transactions ?? 60;
  }

  return DEFAULT_QUERY_CACHE_TTL_MS;
}

/**
 * Check if query should be cached
 * Only cache queries, not mutations
 * @param query - GraphQL query string
 * @returns True if query should be cached
 */
function shouldCache(query: string): boolean {
  // Only cache queries, not mutations
  if (query.trim().startsWith('mutation')) {
    return false;
  }

  // Don't cache introspection queries
  if (query.includes('__schema') || query.includes('__type') || query.includes('IntrospectionQuery')) {
    return false;
  }

  return true;
}

/**
 * GraphQL Response Caching Plugin
 * Caches query responses to reduce database load
 */
export function graphqlCachePlugin(): ApolloServerPlugin<GraphQLContext | Record<string, never>> {
  return {
    requestDidStart(
      requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
    ): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>> {
      const {request, contextValue} = requestContext;
      const query = request.query ?? '';
      const variables = request.variables as Record<string, unknown> | undefined;

      // Only cache queries
      if (!shouldCache(query)) {
        return Promise.resolve({} as GraphQLRequestListener<GraphQLContext | Record<string, never>>);
      }

      const userId = contextValue && typeof contextValue === 'object' && 'userId' in contextValue
        ? (contextValue as GraphQLContext).userId
        : undefined;

      const cacheKey = generateCacheKey(query, variables, userId);
      const cacheTTL = getCacheTTL(query);

      return Promise.resolve({
        async willSendResponse(
          responseContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
        ): Promise<void> {
          try {
            // Only cache successful responses
            if (responseContext.response.body && typeof responseContext.response.body === 'object') {
              const body = responseContext.response.body as {kind?: string; singleResult?: {data?: unknown; errors?: unknown[]}};
              if (body.kind === 'single' && body.singleResult) {
                // Only cache if there's data and no errors
                if (body.singleResult.data && (!body.singleResult.errors || body.singleResult.errors.length === 0)) {
                  await postgresCache.set(cacheKey, body.singleResult.data, cacheTTL).catch((error) => {
                    // Log but don't fail the request if caching fails
                    logError('Failed to cache GraphQL response', {
                      event: 'graphql_cache_set_failed',
                      cacheKey,
                    }, error instanceof Error ? error : new Error(String(error)));
                  });
                }
              }
            }
          } catch (error) {
            // Log but don't fail the request if caching fails
            logError('Error in GraphQL cache plugin', {
              event: 'graphql_cache_plugin_error',
            }, error instanceof Error ? error : new Error(String(error)));
          }
        },
      } as GraphQLRequestListener<GraphQLContext | Record<string, never>>);
    },
  };
}

/**
 * Get cached GraphQL query response
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @param userId - User ID
 * @returns Cached response or null
 */
export async function getCachedQueryResponse<T>(
  query: string,
  variables: Record<string, unknown> | undefined,
  userId?: string,
): Promise<T | null> {
  if (!shouldCache(query)) {
    return null;
  }

  const cacheKey = generateCacheKey(query, variables, userId);
  return postgresCache.get<T>(cacheKey);
}

/**
 * Invalidate cache for a user
 * Useful when user data changes
 * @param userId - User ID
 */
export function invalidateUserCache(userId: string): void {
  // Note: This is a simple implementation
  // For production, you might want to use cache tags or more sophisticated invalidation
  // For now, we rely on TTL-based expiration
  logInfo('User cache invalidation requested', {
    event: 'user_cache_invalidation',
    userId,
    note: 'Cache will expire based on TTL',
  });
}
