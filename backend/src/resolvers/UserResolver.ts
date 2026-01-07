/**
 * User Resolver
 * Handles user-related GraphQL operations
 */

 
import type {GraphQLContext} from '../middleware/context';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {validateContext} from '../utils/baseResolver';
import {NotFoundError} from '../utils/errors';

export class UserResolver {
  /**
   * Get current user information
   */
  async me(_: unknown, __: unknown, context: GraphQLContext): Promise<{id: string; oidcSubject: string; email: string; createdAt: Date; updatedAt: Date}> {
    validateContext(context);
    return await withPrismaErrorHandling(
      async () => {
        const user = await context.prisma.user.findUnique({
          where: {id: context.userId},
        });

        if (!user) {
          throw new NotFoundError('User');
        }

        return user;
      },
      {resource: 'User', operation: 'read'},
    );
  }
}

