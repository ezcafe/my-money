/**
 * Apollo Server Configuration
 * Configures Apollo Server with plugins and error handling
 */

import {ApolloServer} from '@apollo/server';
import type {GraphQLRequestContext, GraphQLRequestListener} from '@apollo/server';
import {GraphQLError} from 'graphql';
import depthLimit from 'graphql-depth-limit';
import type {GraphQLContext} from '../middleware/context';
import {AppError} from '../utils/errors';
import {inputSanitizationPlugin} from '../middleware/inputSanitizationPlugin';
import {validationPlugin} from '../middleware/validationPlugin';
import {queryComplexityPlugin} from '../middleware/queryComplexityPlugin';
import {queryCostPlugin} from '../middleware/queryCostPlugin';
import {graphqlCachePlugin} from '../middleware/graphqlCachePlugin';
import {ErrorCode} from '../utils/errorCodes';

/**
 * Create Apollo Server instance
 * @param typeDefs - GraphQL schema type definitions
 * @param resolvers - GraphQL resolvers
 * @returns Configured Apollo Server instance
 */
export function createApolloServer(
  typeDefs: string,
  resolvers: unknown,
): ApolloServer<GraphQLContext | Record<string, never>> {
  return new ApolloServer<GraphQLContext | Record<string, never>>({
    typeDefs,
    resolvers: resolvers as never,
    // Disable introspection in production for security
    introspection: process.env.NODE_ENV !== 'production',
    // Query depth limiting - prevent deeply nested queries
    validationRules: [
      depthLimit(10, {ignore: ['__typename']}),
    ],
    plugins: [
      // Cache plugin should be early to check cache before other processing
      graphqlCachePlugin(),
      inputSanitizationPlugin(),
      validationPlugin(),
      queryComplexityPlugin({
        maximumComplexity: 1000,
        defaultComplexity: 1,
      }),
      queryCostPlugin({
        maximumCost: 100,
        baseCostPerField: 1,
        costMultiplierPerDepth: 0.5,
      }),
      {
        requestDidStart(_requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>> {
          // Store requestId for error formatting (generate if not available)
          const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;

          return Promise.resolve({
            didEncounterErrors(
              errorContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
            ): void {
              // Format custom errors properly
              if (errorContext.errors) {
                errorContext.errors.forEach((error) => {
                  if ('originalError' in error && error.originalError instanceof AppError) {
                    // Create new error with proper extensions
                    Object.assign(error, {
                      extensions: {
                        ...error.extensions,
                        code: error.originalError.code,
                        statusCode: error.originalError.statusCode,
                        requestId,
                        timestamp: new Date().toISOString(),
                      },
                    });
                  } else {
                    // Add requestId and timestamp to all errors
                    const extensions = error.extensions && typeof error.extensions === 'object' ? error.extensions as Record<string, unknown> : {};
                    Object.assign(error, {
                      extensions: {
                        ...extensions,
                        requestId,
                        timestamp: new Date().toISOString(),
                      },
                    });
                  }
                });
              }
            },
          } as GraphQLRequestListener<GraphQLContext | Record<string, never>>);
        },
      },
    ],
    formatError: (error): GraphQLError => {
      // Get error code from extensions
      const extensions = error.extensions && typeof error.extensions === 'object' ? error.extensions as Record<string, unknown> : {};
      const code = extensions.code as string | undefined;
      const statusCode = extensions.statusCode as number | undefined;
      const requestId = extensions.requestId as string | undefined;
      const timestamp = extensions.timestamp as string | undefined;

      // Sanitize error messages in production to prevent information disclosure
      if (process.env.NODE_ENV === 'production') {
        // Don't expose internal errors, file paths, or database structure
        if (code === ErrorCode.INTERNAL_SERVER_ERROR) {
          return new GraphQLError('Internal server error', {
            extensions: {
              code: ErrorCode.INTERNAL_SERVER_ERROR,
              statusCode: 500,
              timestamp: timestamp ?? new Date().toISOString(),
              requestId,
            },
          });
        }

        // Sanitize error messages that might contain sensitive information
        const message = error.message;
        // Remove file paths, database details, and stack traces
        const sanitizedMessage = message
          .replace(/\/[^\s]+/g, '[path]') // Remove file paths
          .replace(/at\s+[^\n]+/g, '') // Remove stack trace lines
          .replace(/Error:\s*/g, '') // Remove error prefixes
          .substring(0, 200); // Limit message length

        return new GraphQLError(sanitizedMessage ?? 'An error occurred', {
          extensions: {
            ...extensions,
            code: code ?? ErrorCode.INTERNAL_SERVER_ERROR,
            statusCode: statusCode ?? 500,
            timestamp: timestamp ?? new Date().toISOString(),
            requestId,
          },
        });
      }

      // Return formatted error with extensions in development
      // Convert GraphQLFormattedError to GraphQLError
      const originalError = 'originalError' in error && error.originalError instanceof Error
        ? error.originalError
        : undefined;
      return new GraphQLError(
        error.message,
        undefined,
        undefined,
        undefined,
        undefined,
        originalError,
        {
          ...extensions,
          code: code ?? ErrorCode.INTERNAL_SERVER_ERROR,
          statusCode: statusCode ?? 500,
          timestamp: timestamp ?? new Date().toISOString(),
          requestId,
          path: error.path,
          // Include validation errors if present
          validationErrors: extensions.validationErrors,
        },
      );
    },
  });
}

