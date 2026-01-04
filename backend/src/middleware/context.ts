/**
 * GraphQL Context
 * Provides user information and database access to resolvers
 */

import type {FastifyRequest} from 'fastify';
import {prisma} from '../utils/prisma';
import {getUserFromToken} from './auth';
import {UnauthorizedError} from '../utils/errors';
import {createDataLoaders} from '../utils/dataloaders';
import type {DataLoaderContext} from '../utils/dataloaders';

export interface GraphQLContext extends DataLoaderContext {
  userId: string;
  userEmail?: string;
  prisma: typeof prisma;
}

/**
 * Create GraphQL context from request
 * Requires authentication for all operations
 */
export async function createContext(req: FastifyRequest): Promise<GraphQLContext | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('No authorization header provided');
  }

  const token = authHeader.replace('Bearer ', '');
  const userInfo = await getUserFromToken(token);

  // Find or create user in database using upsert to prevent race conditions
  // If two requests come in simultaneously for a new user, upsert ensures only one is created
  const user = await prisma.user.upsert({
    where: {oidcSubject: userInfo.sub},
    update: {
      // Update email if it has changed (e.g., user updated their email in OIDC provider)
      email: userInfo.email ?? undefined,
    },
    create: {
      oidcSubject: userInfo.sub,
      email: userInfo.email ?? '',
    },
  });

  const dataLoaders = createDataLoaders();

  return {
    userId: user.id,
    userEmail: user.email,
    prisma,
    ...dataLoaders,
  };
}


