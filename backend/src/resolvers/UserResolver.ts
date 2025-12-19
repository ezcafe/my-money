/**
 * User Resolver
 * Handles user-related GraphQL operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type {GraphQLContext} from '../middleware/context';

export class UserResolver {
  /**
   * Get current user information
   */
  async me(_: unknown, __: unknown, context: GraphQLContext): Promise<{id: string; oidcSubject: string; email: string; createdAt: Date; updatedAt: Date}> {
    const user = await context.prisma.user.findUnique({
      where: {id: context.userId},
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}

