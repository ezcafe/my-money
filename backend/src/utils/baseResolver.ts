/**
 * Base Resolver
 * Provides common functionality for all resolvers
 */

import type { GraphQLContext } from '../middleware/context';
import { UnauthorizedError } from './errors';

/**
 * Validate that context has a valid userId
 * Should be called at the start of resolver methods that require authentication
 * @param context - GraphQL context
 * @throws UnauthorizedError if userId is missing
 */
export function validateContext(context: GraphQLContext): void {
  if (
    !context.userId ||
    typeof context.userId !== 'string' ||
    context.userId.trim().length === 0
  ) {
    throw new UnauthorizedError('Invalid user context: userId is required');
  }
}
