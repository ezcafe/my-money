/**
 * Apollo Server Handler for Hono
 * Custom integration to connect Apollo Server with Hono framework
 */

import type {Context} from 'hono';
import type {ApolloServer} from '@apollo/server';
import type {GraphQLContext} from '../middleware/context';
import {createContext} from '../middleware/context';
import {checkRateLimit} from '../utils/postgresRateLimiter';
import {ErrorCode} from '../utils/errorCodes';
import {getCachedQueryResponse} from '../middleware/graphqlCachePlugin';

/**
 * Create Apollo Server handler for Hono
 * @param server - Apollo Server instance
 * @returns Hono handler function
 */
export function createApolloHandler(
  server: ApolloServer<GraphQLContext | Record<string, never>>,
) {
  return async (c: Context): Promise<Response> => {
    try {
      // Parse query first to check if it's an introspection query
      let body: {query?: string; variables?: unknown; operationName?: string} | null = null;

      // Check if body was already parsed by multipart handler
      const preParsedBody = (c.req as {body?: unknown}).body;
      if (preParsedBody && typeof preParsedBody === 'object') {
        body = preParsedBody as {query?: string; variables?: unknown; operationName?: string};
      } else if (c.req.method === 'GET') {
        // For GET requests, parse query string
        const url = new URL(c.req.url);
        const query = url.searchParams.get('query');
        if (query) {
          body = {query};
        }
      } else {
        // For POST requests, try to get body using Hono's methods
        const requestBody = await c.req.json().catch(() => null) as {query?: string; variables?: unknown; operationName?: string} | null;
        if (requestBody && typeof requestBody === 'object') {
          body = requestBody;
        } else {
          // Body might already be consumed, try text as fallback
          const textBody = await c.req.text().catch(() => null);
          if (textBody) {
            try {
              body = JSON.parse(textBody) as {query?: string; variables?: unknown; operationName?: string};
            } catch {
              // If all else fails, body is null
            }
          }
        }
      }

      // Check if query is an introspection query
      const isIntrospection = body?.query?.includes('__schema') ?? body?.query?.includes('__type') ?? body?.query?.includes('IntrospectionQuery') ?? false;

      // Create GraphQL context from Hono context (skip for introspection queries)
      let graphQLContext: GraphQLContext | null = null;
      if (!isIntrospection) {
        graphQLContext = await createContext(c);

        // Apply user-based rate limiting for authenticated requests
        // Stricter limits for authenticated users (200 requests per minute)
        if (graphQLContext?.userId) {
          const userRateLimitResult = await checkRateLimit(
            `user:${graphQLContext.userId}`,
            200, // Higher limit for authenticated users
            60 * 1000, // 1 minute window
          );

          if (!userRateLimitResult.allowed) {
            return c.json(
              {
                errors: [
                  {
                    message: 'User rate limit exceeded',
                    extensions: {
                      code: ErrorCode.RATE_LIMIT_EXCEEDED,
                      statusCode: 429,
                    },
                  },
                ],
              },
              429,
            );
          }

          // Add rate limit headers
          c.header('X-RateLimit-Limit', '200');
          c.header('X-RateLimit-Remaining', String(userRateLimitResult.remaining));
          c.header('X-RateLimit-Reset', String(Math.ceil(userRateLimitResult.resetAt / 1000)));
        }
      }

      if (!body?.query) {
        return c.json(
          {
            errors: [
              {
                message: 'GraphQL query is required',
                extensions: {
                  code: 'BAD_REQUEST',
                },
              },
            ],
          },
          400,
        );
      }

      // Check cache for query response (only for queries, not mutations)
      if (body.query && !body.query.trim().startsWith('mutation') && graphQLContext) {
        const cachedResponse = await getCachedQueryResponse<unknown>(
          body.query,
          body.variables as Record<string, unknown> | undefined,
          graphQLContext.userId,
        );

        if (cachedResponse) {
          // Return cached response
          return c.json({
            data: cachedResponse,
          }, 200);
        }
      }

      // Execute the GraphQL operation
      const result = await server.executeOperation(
        {
          query: body.query,
          variables: body.variables as Record<string, unknown> | undefined,
          operationName: body.operationName,
        },
        {
          contextValue: (graphQLContext ?? {}) as GraphQLContext | Record<string, never>,
        },
      );

      // Convert Apollo Server result to Hono response
      // executeOperation returns a GraphQLResponse with { body: { kind: 'single', singleResult: { data?, errors? } } } structure
      // Extract the singleResult from the body
      const response: {data?: unknown; errors?: unknown[]} = {};
      if (result && typeof result === 'object' && result.body) {
        const bodyResult = (result as {body?: {kind?: string; singleResult?: {data?: unknown; errors?: unknown[]}}}).body;
        if (bodyResult?.kind === 'single' && bodyResult.singleResult) {
          if ('data' in bodyResult.singleResult && bodyResult.singleResult.data !== undefined) {
            response.data = bodyResult.singleResult.data;
          }
          if ('errors' in bodyResult.singleResult && Array.isArray(bodyResult.singleResult.errors) && bodyResult.singleResult.errors.length > 0) {
            response.errors = bodyResult.singleResult.errors;
          }
        }
      }

      return c.json(response, 200);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      console.error('Apollo Server handler error:', errorObj);
      return c.json(
        {
          errors: [
            {
              message: errorObj.message,
              extensions: {
                code: 'INTERNAL_SERVER_ERROR',
              },
            },
          ],
        },
        500,
      );
    }
  };
}
