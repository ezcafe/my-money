/**
 * GraphQL Context
 * Provides user information and database access to resolvers
 */

import type {Context} from 'hono';
import {getCookie} from 'hono/cookie';
import {randomUUID} from 'crypto';
import {prisma} from '../utils/prisma';
import {getUserFromToken} from './auth';
import {UnauthorizedError} from '../utils/errors';
import {createDataLoaders} from '../utils/dataloaders';
import type {DataLoaderContext} from '../utils/dataloaders';
import {logAuthFailure} from '../utils/securityLogger';
import * as postgresCache from '../utils/postgresCache';
import {userKey} from '../utils/cacheKeys';
import {setCorrelationId} from '../utils/logger';

export interface GraphQLContext extends DataLoaderContext {
  userId: string;
  userEmail?: string;
  requestId: string;
  prisma: typeof prisma;
  request?: Context;
}

/**
 * Create GraphQL context from request
 * Requires authentication for all operations
 * Supports both cookie-based (preferred) and Authorization header (fallback) authentication
 */
export async function createContext(c: Context): Promise<GraphQLContext | null> {
  // Try to get token from cookie first (preferred method)
  // Cookie name matches COOKIE_NAMES.ACCESS_TOKEN from cookies.ts
  const accessToken = getCookie(c, 'access_token');
  const authHeader = c.req.header('Authorization');

  // Fallback to Authorization header if no cookie (for backward compatibility during migration)
  const token = accessToken ?? (authHeader ? authHeader.replace('Bearer ', '') : null);

  if (!token) {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
    const userAgent = c.req.header('User-Agent') ?? 'unknown';
    logAuthFailure('No authentication token provided', {
      ip,
      userAgent,
      hasCookie: !!accessToken,
      hasHeader: !!authHeader,
    });
    throw new UnauthorizedError('No authentication token provided');
  }

  let userInfo: {sub: string; email?: string};
  try {
    userInfo = await getUserFromToken(token);
  } catch (error) {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
    const userAgent = c.req.header('User-Agent') ?? 'unknown';
    logAuthFailure('Token validation failed', {
      ip,
      userAgent,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }

  // Check cache for user lookup
  const userCacheKey = userKey(userInfo.sub);
  const USER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  let user = await postgresCache.get<{
    id: string;
    oidcSubject: string;
    email: string;
  }>(userCacheKey);

  if (!user) {
    // Find or create user in database using upsert to prevent race conditions
    // If two requests come in simultaneously for a new user, upsert ensures only one is created
    user = await prisma.user.upsert({
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

    // Cache user lookup (fire and forget)
    void postgresCache.set(userCacheKey, user, USER_CACHE_TTL_MS).catch(() => {
      // Ignore cache errors
    });
  }

  // Validate that userId exists (should always be true after upsert, but explicit check for safety)
  if (!user.id) {
    throw new UnauthorizedError('User ID not found after authentication');
  }

  const dataLoaders = createDataLoaders();

  // Generate correlation ID (request ID) for tracing
  const requestId = randomUUID();
  
  // Set global correlation ID for logging
  setCorrelationId(requestId);

  return {
    userId: user.id,
    userEmail: user.email,
    requestId,
    prisma,
    request: c,
    ...dataLoaders,
  };
}


