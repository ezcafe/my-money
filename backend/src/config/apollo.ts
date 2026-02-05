/**
 * Apollo Server Configuration
 * Configures Apollo Server with plugins and error handling
 */

import { ApolloServer } from '@apollo/server';
import type {
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { GraphQLError } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import type { GraphQLContext } from '../middleware/context';
import { AppError } from '../utils/errors';
import { inputSanitizationPlugin } from '../middleware/inputSanitizationPlugin';
import { validationPlugin } from '../middleware/validationPlugin';
import { queryComplexityPlugin } from '../middleware/queryComplexityPlugin';
import { queryCostPlugin } from '../middleware/queryCostPlugin';
import { graphqlCachePlugin } from '../middleware/graphqlCachePlugin';

/**
 * Create Apollo Server instance
 * @param typeDefs - GraphQL schema type definitions
 * @param resolvers - GraphQL resolvers
 * @returns Configured Apollo Server instance
 */
export function createApolloServer(
  typeDefs: string,
  resolvers: unknown
): ApolloServer<GraphQLContext | Record<string, never>> {
  return new ApolloServer<GraphQLContext | Record<string, never>>({
    typeDefs,
    resolvers: resolvers as never,
    // Disable introspection in production for security
    introspection: process.env.NODE_ENV !== 'production',
    // Query depth limiting - prevent deeply nested queries
    validationRules: [depthLimit(10, { ignore: ['__typename'] })],
    plugins: [
      // Cache plugin should be early to check cache before other processing
      graphqlCachePlugin(),
      inputSanitizationPlugin(),
      validationPlugin(),
      queryComplexityPlugin({
        maximumComplexity: 500,
        defaultComplexity: 1,
      }),
      queryCostPlugin({
        maximumCost: 100,
        baseCostPerField: 1,
        costMultiplierPerDepth: 0.5,
      }),
      {
        requestDidStart(
          _requestContext: GraphQLRequestContext<
            GraphQLContext | Record<string, never>
          >
        ): Promise<
          GraphQLRequestListener<GraphQLContext | Record<string, never>>
        > {
          // Store requestId for error formatting (generate if not available)
          const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;

          return Promise.resolve({
            didEncounterErrors(
              errorContext: GraphQLRequestContext<
                GraphQLContext | Record<string, never>
              >
            ): void {
              // Format custom errors properly
              if (errorContext.errors) {
                errorContext.errors.forEach((error) => {
                  if (
                    'originalError' in error &&
                    error.originalError instanceof AppError
                  ) {
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
                    const extensions =
                      error.extensions && typeof error.extensions === 'object'
                        ? (error.extensions as Record<string, unknown>)
                        : {};
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
    formatError: (error: unknown): GraphQLError => {
      // Preserve AppError-derived errors (ValidationError, NotFoundError, etc.)
      // set by didEncounterErrors; otherwise return safe default for stability
      try {
        if (typeof error === 'string') {
          return new GraphQLError(error.slice(0, 200), {
            extensions: {
              code: 'INTERNAL_SERVER_ERROR',
              statusCode: 500,
            },
          });
        }

        if (error && typeof error === 'object') {
          let code: unknown;
          let statusCode: unknown;
          let ext: Record<string, unknown> | null = null;
          const hasExt =
            'extensions' in error &&
            typeof (error as { extensions: unknown }).extensions === 'object' &&
            (error as { extensions: unknown }).extensions !== null &&
            !Array.isArray((error as { extensions: unknown }).extensions);
          if (hasExt) {
            ext = (error as { extensions: Record<string, unknown> }).extensions;
            code = ext.code;
            statusCode = ext.statusCode;
          }
          const hasOrig =
            'originalError' in error &&
            (error as { originalError: unknown }).originalError instanceof
              AppError;
          if ((code == null || statusCode == null) && hasOrig) {
            const orig = (error as { originalError: AppError }).originalError;
            code = orig.code;
            statusCode = orig.statusCode;
            ext = ext ?? { code, statusCode };
          }
          const knownAppCodes = [
            'VALIDATION_ERROR',
            'NOT_FOUND',
            'BAD_USER_INPUT',
            'CONFLICT',
            'FORBIDDEN',
            'UNAUTHORIZED',
          ];
          if (
            typeof code === 'string' &&
            typeof statusCode === 'number' &&
            knownAppCodes.includes(code)
          ) {
            let msg = 'Error';
            if (
              'message' in error &&
              typeof (error as { message: unknown }).message === 'string'
            ) {
              msg = (error as { message: string }).message;
            } else if (ext && hasOrig) {
              msg = (error as { originalError: AppError }).originalError
                .message;
            }
            return new GraphQLError(msg.slice(0, 500), {
              extensions: { ...ext, code, statusCode },
            });
          }
        }

        return new GraphQLError('Internal server error', {
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            statusCode: 500,
          },
        });
      } catch {
        return new GraphQLError('Error', {
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            statusCode: 500,
          },
        });
      }
    },
  });
}
