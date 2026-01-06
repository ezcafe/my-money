/**
 * Apollo Server Configuration
 * Configures Apollo Server with plugins and error handling
 */

import {ApolloServer} from '@apollo/server';
import type {GraphQLRequestContext, GraphQLRequestListener} from '@apollo/server';
import {GraphQLError} from 'graphql';
import type {GraphQLContext} from '../middleware/context';
import {AppError} from '../utils/errors';
import {inputSanitizationPlugin} from '../middleware/inputSanitizationPlugin';
import {fastifyApolloDrainPlugin} from '@as-integrations/fastify';
import type {FastifyInstance} from 'fastify';

/**
 * Create Apollo Server instance
 * @param typeDefs - GraphQL schema type definitions
 * @param resolvers - GraphQL resolvers
 * @param fastify - Fastify instance for drain plugin
 * @returns Configured Apollo Server instance
 */
export function createApolloServer(
  typeDefs: string,
  resolvers: unknown,
  fastify: FastifyInstance,
): ApolloServer<GraphQLContext | Record<string, never>> {
  return new ApolloServer<GraphQLContext | Record<string, never>>({
    typeDefs,
    resolvers: resolvers as never,
    // Disable introspection in production for security
    introspection: process.env.NODE_ENV !== 'production',
    plugins: [
      fastifyApolloDrainPlugin(fastify),
      inputSanitizationPlugin(),
      {
        requestDidStart(_requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>> {
          return Promise.resolve({
            didEncounterErrors(
              requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
            ): void {
              // Format custom errors properly
              if (requestContext.errors) {
                requestContext.errors.forEach((error) => {
                  if ('originalError' in error && error.originalError instanceof AppError) {
                    // Create new error with proper extensions
                    Object.assign(error, {
                      extensions: {
                        ...error.extensions,
                        code: error.originalError.code,
                        statusCode: error.originalError.statusCode,
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
      // Sanitize error messages in production to prevent information disclosure
      if (process.env.NODE_ENV === 'production') {
        // Don't expose internal errors, file paths, or database structure
        if (error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
          return new GraphQLError('Internal server error', {
            extensions: {
              code: 'INTERNAL_SERVER_ERROR',
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

        return new GraphQLError(sanitizedMessage || 'An error occurred', {
          extensions: error.extensions,
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
        error.extensions,
      );
    },
  });
}

