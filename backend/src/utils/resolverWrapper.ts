/**
 * Resolver Wrapper
 * Provides consistent error handling for all resolvers
 */

import type { GraphQLResolveInfo } from 'graphql';
import type { GraphQLContext } from '../middleware/context';
import { logError } from './logger';

/**
 * Wrapper function for resolvers that provides consistent error handling
 * Logs errors with correlation IDs and user context
 * @param resolver - Resolver function to wrap
 * @param resolverName - Name of the resolver for logging
 * @returns Wrapped resolver with error handling
 */
export function withErrorHandling<TArgs, TReturn>(
  resolver: (
    parent: unknown,
    args: TArgs,
    context: GraphQLContext,
    info: GraphQLResolveInfo
  ) => Promise<TReturn> | TReturn,
  resolverName: string
): (
  parent: unknown,
  args: TArgs,
  context: GraphQLContext,
  info: GraphQLResolveInfo
) => Promise<TReturn> {
  return async (parent, args, context, info) => {
    try {
      return await resolver(parent, args, context, info);
    } catch (error) {
      // Log error with correlation IDs and user context
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      logError(
        `Error in resolver: ${resolverName}`,
        {
          resolverName,
          userId: context.userId,
          requestId: context.requestId,
          operation: info.operation.operation,
          fieldName: info.fieldName,
        },
        errorObj
      );

      // Re-throw the error (Apollo Server will handle formatting)
      throw error;
    }
  };
}
