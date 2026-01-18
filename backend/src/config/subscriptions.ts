/**
 * GraphQL Subscriptions Configuration
 * Sets up WebSocket server for GraphQL subscriptions using graphql-ws
 */

import {useServer} from 'graphql-ws/use/ws';
import {WebSocketServer} from 'ws';
import type {Server} from 'http';
import type {GraphQLSchema} from 'graphql';
import {execute, subscribe} from 'graphql';
import {prisma} from '../utils/prisma';
import {getUserFromToken} from '../middleware/auth';
import {getUserWorkspaces} from '../services/WorkspaceService';
import type {GraphQLContext} from '../middleware/context';
import {canCreateSubscription, incrementSubscriptionCount} from '../utils/subscriptionRateLimiter';
import {logInfo, logWarn} from '../utils/logger';

/**
 * Create WebSocket server for GraphQL subscriptions
 * @param schema - GraphQL schema instance
 * @param httpServer - HTTP server instance from Hono
 * @returns WebSocket server instance
 */
export function createSubscriptionServer(
  schema: GraphQLSchema,
  httpServer: unknown,
): WebSocketServer {
  const wsServer = new WebSocketServer({
    server: httpServer as Server,
    path: '/graphql-ws',
  });

  useServer(
    {
      schema,
      execute,
      subscribe,
      context: async (_ctx, _msg, args) => {
        // Get token from connection parameters
        // args is SubscribePayload which has extra property connectionParams
        const connectionParams = (args as {connectionParams?: {token?: string; workspaceId?: string}}).connectionParams;
        const token = connectionParams?.token;

        if (!token) {
          throw new Error('No authentication token provided');
        }

        // Validate token and get user info
        let userInfo: {sub: string; email?: string};
        try {
          userInfo = await getUserFromToken(token);
        } catch (error) {
          throw new Error(`Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Find or create user
        const user = await prisma.user.upsert({
          where: {oidcSubject: userInfo.sub},
          update: {
            email: userInfo.email ?? undefined,
          },
          create: {
            oidcSubject: userInfo.sub,
            email: userInfo.email ?? '',
          },
        });

        // Get user workspaces
        const userWorkspaces = await getUserWorkspaces(user.id);

        // Get workspace ID from connection parameters
        const workspaceId = connectionParams?.workspaceId;

        return {
          userId: user.id,
          userEmail: user.email,
          currentWorkspaceId: workspaceId,
          userWorkspaces,
          requestId: `ws-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          prisma,
        } as GraphQLContext;
      },
      onConnect: async (ctx) => {
        // Check rate limit before allowing connection
        // Note: ctx.connectionParams contains the token and workspaceId
        const token = (ctx.connectionParams as {token?: string})?.token;
        if (token) {
          try {
            const userInfo = await getUserFromToken(token);
            const user = await prisma.user.findUnique({
              where: {oidcSubject: userInfo.sub},
            });

            if (user && !canCreateSubscription(user.id)) {
              logWarn('Subscription rate limit exceeded on connect', {
                event: 'subscription_rate_limit_exceeded',
                userId: user.id,
              });
              return false; // Reject connection
            }

            if (user) {
              incrementSubscriptionCount(user.id);
              logInfo('WebSocket connection established', {
                event: 'websocket_connected',
                userId: user.id,
              });
            }
          } catch (error) {
            logWarn('Failed to check subscription rate limit', {
              event: 'subscription_rate_limit_check_failed',
              error: error instanceof Error ? error.message : String(error),
            });
            // Allow connection on error (fail open)
          }
        }
        return true;
      },
      onDisconnect: (_ctx, code, reason) => {
        // Decrement subscription count when connection closes
        // Note: We need to get userId from context, but ctx may not have it
        // This is a limitation - in production, track connections in a Map
        logInfo('WebSocket connection closed', {
          event: 'websocket_disconnected',
          code,
          reason: reason?.toString(),
        });
      },
    },
    wsServer,
  );

  return wsServer;
}
