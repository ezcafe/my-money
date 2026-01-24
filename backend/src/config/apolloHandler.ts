/**
 * Apollo Server Handler for Hono
 * Custom integration to connect Apollo Server with Hono framework
 */

import type { Context } from 'hono';
import type { ApolloServer } from '@apollo/server';
import type { GraphQLContext } from '../middleware/context';
import { createContext } from '../middleware/context';
import { checkRateLimit } from '../utils/postgresRateLimiter';
import { ErrorCode } from '../utils/errorCodes';
import { getCachedQueryResponse } from '../middleware/graphqlCachePlugin';

/**
 * Create Apollo Server handler for Hono
 * @param server - Apollo Server instance
 * @returns Hono handler function
 */
export function createApolloHandler(
  server: ApolloServer<GraphQLContext | Record<string, never>>
) {
  return async (c: Context): Promise<Response> => {
    try {
      // Parse query first to check if it's an introspection query
      let body: {
        query?: string;
        variables?: unknown;
        operationName?: string;
      } | null = null;

      // Check if body was already parsed by multipart handler
      const preParsedBody = (c.req as { body?: unknown }).body;
      if (preParsedBody && typeof preParsedBody === 'object') {
        body = preParsedBody;
      } else if (c.req.method === 'GET') {
        // For GET requests, parse query string
        const url = new URL(c.req.url);
        const query = url.searchParams.get('query');
        if (query) {
          body = { query };
        }
      } else {
        // For POST requests, try to get body using Hono's methods
        const requestBody = (await c.req.json().catch(() => null)) as unknown;
        if (requestBody && typeof requestBody === 'object') {
          body = requestBody;
        } else {
          // Body might already be consumed, try text as fallback
          const textBody = await c.req.text().catch(() => null);
          if (textBody) {
            try {
              body = JSON.parse(textBody) as {
                query?: string;
                variables?: unknown;
                operationName?: string;
              } | null;
            } catch {
              // If all else fails, body is null
            }
          }
        }
      }

      // Handle batched requests from BatchHttpLink
      // BatchHttpLink sends an array of operations: [{query, variables, operationName}, ...]
      let operations: Array<{
        query: string;
        variables?: unknown;
        operationName?: string;
      }> = [];
      if (Array.isArray(body)) {
        operations = body.filter(
          (
            op
          ): op is {
            query: string;
            variables?: unknown;
            operationName?: string;
          } => {
            if (op === null || typeof op !== 'object') {
              return false;
            }
            const opObj = op as Record<string, unknown>;
            return 'query' in opObj && typeof opObj.query === 'string';
          }
        );
      } else if (body && typeof body === 'object' && 'query' in body) {
        const bodyObj = body as Record<string, unknown>;
        if (typeof bodyObj.query === 'string') {
          // Single operation
          operations = [
            body as {
              query: string;
              variables?: unknown;
              operationName?: string;
            },
          ];
        }
      }

      if (operations.length === 0) {
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
          400
        );
      }

      // Use first operation for introspection and operation type detection
      const firstOperation = operations[0];
      if (!firstOperation) {
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
          400
        );
      }
      // Check if query is an introspection query
      // Must check for __schema or __type as standalone identifiers (not __typename)
      // Use regex to match word boundaries to avoid matching __typename
      const isIntrospection =
        /(^|\s)__schema(\s|\(|{)/.test(firstOperation.query) ||
        /(^|\s)__type(\s|\(|{)/.test(firstOperation.query) ||
        firstOperation.query.includes('IntrospectionQuery');

      // Detect operation type for granular rate limiting
      const isMutation = firstOperation.query.trim().startsWith('mutation');
      const isQuery = firstOperation.query.trim().startsWith('query');
      const hasFileUpload = firstOperation.query.includes('Upload');

      // Create GraphQL context from Hono context (skip for introspection queries)
      let graphQLContext: GraphQLContext | null = null;
      if (!isIntrospection) {
        try {
          graphQLContext = await createContext(c);
        } catch {
          // If context creation fails, return 401 for all operations
          return c.json(
            {
              errors: operations.map(() => ({
                message: 'Authentication required',
                extensions: {
                  code: 'UNAUTHORIZED',
                  statusCode: 401,
                },
              })),
            },
            401
          );
        }

        // Apply granular rate limiting for authenticated requests
        if (graphQLContext?.userId) {
          // Import rate limit constants
          const { RATE_LIMITS } = await import('../utils/constants');

          // Determine rate limit based on operation type
          let rateLimit: number;
          let operationType: string;

          if (hasFileUpload) {
            // File uploads (e.g., uploadPDF, importCSV)
            rateLimit = RATE_LIMITS.UPLOADS;
            operationType = 'upload';
          } else if (isMutation) {
            // GraphQL mutations
            rateLimit = RATE_LIMITS.MUTATIONS;
            operationType = 'mutation';
          } else if (isQuery) {
            // GraphQL queries
            rateLimit = RATE_LIMITS.USER_QUERIES;
            operationType = 'query';
          } else {
            // Default to query limit for unknown operations
            rateLimit = RATE_LIMITS.USER_QUERIES;
            operationType = 'query';
          }

          const userRateLimitResult = await checkRateLimit(
            `user:${graphQLContext.userId}:${operationType}`,
            rateLimit,
            RATE_LIMITS.WINDOW_MS
          );

          if (!userRateLimitResult.allowed) {
            return c.json(
              {
                errors: [
                  {
                    message: `${operationType.charAt(0).toUpperCase() + operationType.slice(1)} rate limit exceeded`,
                    extensions: {
                      code: ErrorCode.RATE_LIMIT_EXCEEDED,
                      statusCode: 429,
                    },
                  },
                ],
              },
              429
            );
          }

          // Add rate limit headers
          c.header('X-RateLimit-Limit', String(rateLimit));
          c.header(
            'X-RateLimit-Remaining',
            String(userRateLimitResult.remaining)
          );
          c.header(
            'X-RateLimit-Reset',
            String(Math.ceil(userRateLimitResult.resetAt / 1000))
          );
        }
      }

      // Execute all operations (handle both single and batched requests)
      const results = await Promise.all(
        operations.map(async (operation) => {
          // Check if THIS specific operation is an introspection query
          // Must check for __schema or __type as standalone identifiers (not __typename)
          // Use regex to match word boundaries to avoid matching __typename
          const operationIsIntrospection =
            /(^|\s)__schema(\s|\(|{)/.test(operation.query) ||
            /(^|\s)__type(\s|\(|{)/.test(operation.query) ||
            operation.query.includes('IntrospectionQuery');

          // Validate context for non-introspection queries
          if (!operationIsIntrospection) {
            // Check if context exists
            if (!graphQLContext) {
              return {
                errors: [
                  {
                    message: 'Authentication required',
                    extensions: {
                      code: 'UNAUTHORIZED',
                      statusCode: 401,
                    },
                  },
                ],
              };
            }

            // Validate context has required properties - use try-catch to safely check properties
            let hasValidContext = false;
            try {
              hasValidContext = !!(
                graphQLContext.userId &&
                typeof graphQLContext.userId === 'string' &&
                graphQLContext.userId.trim().length > 0 &&
                graphQLContext.prisma
              );
            } catch {
              hasValidContext = false;
            }

            if (!hasValidContext) {
              return {
                errors: [
                  {
                    message: 'Invalid authentication context',
                    extensions: {
                      code: 'UNAUTHORIZED',
                      statusCode: 401,
                    },
                  },
                ],
              };
            }
          }

          // Check cache for query response (only for queries, not mutations)
          if (
            !operation.query.trim().startsWith('mutation') &&
            graphQLContext?.userId
          ) {
            const cachedResponse = await getCachedQueryResponse<unknown>(
              operation.query,
              operation.variables as Record<string, unknown> | undefined,
              graphQLContext.userId
            );

            if (cachedResponse) {
              // Return cached response
              return { data: cachedResponse };
            }
          }

          // Execute the GraphQL operation
          // For introspection queries, context can be empty; for others, it must be valid
          // Double-check context is valid before executing (operationIsIntrospection already declared above)
          if (!operationIsIntrospection) {
            // Final safety check - ensure context is valid before executing
            try {
              if (!graphQLContext?.userId || !graphQLContext?.prisma) {
                return {
                  errors: [
                    {
                      message: 'Invalid authentication context',
                      extensions: {
                        code: 'UNAUTHORIZED',
                        statusCode: 401,
                      },
                    },
                  ],
                };
              }
            } catch {
              return {
                errors: [
                  {
                    message: 'Invalid authentication context',
                    extensions: {
                      code: 'UNAUTHORIZED',
                      statusCode: 401,
                    },
                  },
                ],
              };
            }
          }

          const contextValue = operationIsIntrospection
            ? ({} as Record<string, never>)
            : (graphQLContext as GraphQLContext);

          let result;
          try {
            result = await server.executeOperation(
              {
                query: operation.query,
                variables: operation.variables as
                  | Record<string, unknown>
                  | undefined,
                operationName: operation.operationName,
              },
              {
                contextValue,
              }
            );
          } catch {
            // If execution throws, return error response
            result = {
              errors: [
                {
                  message: 'Internal server error',
                  extensions: {
                    code: 'INTERNAL_SERVER_ERROR',
                    statusCode: 500,
                  },
                },
              ],
            };
          }

          // Convert Apollo Server result
          const response: { data?: unknown; errors?: unknown[] } = {};
          if (result && typeof result === 'object' && result.body) {
            const bodyResult = (
              result as {
                body?: {
                  kind?: string;
                  singleResult?: { data?: unknown; errors?: unknown[] };
                };
              }
            ).body;
            if (bodyResult?.kind === 'single' && bodyResult.singleResult) {
              if (
                'data' in bodyResult.singleResult &&
                bodyResult.singleResult.data !== undefined
              ) {
                response.data = bodyResult.singleResult.data;
              }
              if (
                'errors' in bodyResult.singleResult &&
                Array.isArray(bodyResult.singleResult.errors) &&
                bodyResult.singleResult.errors.length > 0
              ) {
                response.errors = bodyResult.singleResult.errors;
              }
            }
          }
          return response;
        })
      );

      // Return single result for single operation, array for batched
      if (results.length === 1) {
        return c.json(results[0], 200);
      }
      return c.json(results, 200);
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
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
        500
      );
    }
  };
}
