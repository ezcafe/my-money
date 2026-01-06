/**
 * GraphQL Context
 * Provides user information and database access to resolvers
 */

import type {FastifyRequest} from 'fastify';
import {randomUUID} from 'crypto';
import {prisma} from '../utils/prisma';
import {getUserFromToken} from './auth';
import {UnauthorizedError} from '../utils/errors';
import {createDataLoaders} from '../utils/dataloaders';
import type {DataLoaderContext} from '../utils/dataloaders';
import {logAuthFailure} from '../utils/securityLogger';

export interface GraphQLContext extends DataLoaderContext {
  userId: string;
  userEmail?: string;
  requestId: string;
  prisma: typeof prisma;
  request?: FastifyRequest;
}

/**
 * Create GraphQL context from request
 * Requires authentication for all operations
 */
export async function createContext(req: FastifyRequest): Promise<GraphQLContext | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logAuthFailure('No authorization header provided', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    throw new UnauthorizedError('No authorization header provided');
  }

  const token = authHeader.replace('Bearer ', '');
  let userInfo: {sub: string; email?: string};
  try {
    userInfo = await getUserFromToken(token);
  } catch (error) {
    logAuthFailure('Token validation failed', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }

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

  // Validate that userId exists (should always be true after upsert, but explicit check for safety)
  if (!user.id) {
    throw new UnauthorizedError('User ID not found after authentication');
  }

  const dataLoaders = createDataLoaders();

  // Generate correlation ID (request ID) for tracing
  const requestId = randomUUID();

  return {
    userId: user.id,
    userEmail: user.email,
    requestId,
    prisma,
    request: req,
    ...dataLoaders,
  };
}


