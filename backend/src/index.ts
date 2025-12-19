/**
 * Apollo GraphQL Server Entry Point
 */

import Fastify, {type FastifyRequest} from 'fastify';
import {ApolloServer} from '@apollo/server';
import fastifyApollo, {fastifyApolloDrainPlugin} from '@as-integrations/fastify';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {resolvers} from './resolvers/index';
import {DateTime, Decimal, Upload} from './schema/scalars';
import {createContext} from './middleware/context';
import type {GraphQLContext} from './middleware/context';
import {initializeOIDC} from './middleware/auth';
import {disconnectPrisma} from './utils/prisma';
import {AppError} from './utils/errors';
import {GraphQLError} from 'graphql';
import type {GraphQLRequestContext} from '@apollo/server';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  logger: true,
});

// Register security plugins
async function registerSecurityPlugins(): Promise<void> {
  // CORS configuration - allow frontend to communicate with backend
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow GraphQL Playground in development
  });

  // Rate limiting - general limit
  await fastify.register(rateLimit, {
    max: 100, // 100 requests
    timeWindow: '1 minute',
    skipOnError: false,
    errorResponseBuilder: (_request, context) => {
      return {
        code: 'RATE_LIMIT_EXCEEDED',
        error: 'Too many requests, please try again later',
        message: `Rate limit exceeded, retry in ${Math.ceil(context.ttl / 1000)} seconds`,
      };
    },
  });

  // CSRF protection for mutations - validate Origin header
  fastify.addHook('onRequest', async (request, reply) => {
    const body = request.body as {query?: string} | undefined;
    if (body?.query?.includes('mutation')) {
      // For mutations, validate Origin header to prevent CSRF
      const origin = request.headers.origin;
      const referer = request.headers.referer;
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];

      // In production, require Origin or Referer header for mutations
      if (process.env.NODE_ENV === 'production') {
        if (allowedOrigins.length > 0) {
          const isValidOrigin =
            (origin && allowedOrigins.includes(origin)) ||
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            (referer && allowedOrigins.some((allowed) => referer.startsWith(allowed)));

          if (!isValidOrigin) {
            return reply.code(403).send({
              errors: [
                {
                  message: 'CSRF validation failed',
                  extensions: {
                    code: 'FORBIDDEN',
                    statusCode: 403,
                  },
                },
              ],
            });
          }
        }
      }
    }
  });
}

// Health check endpoint (no rate limit)
fastify.get('/health', (): {status: string; timestamp: string} => {
  return {status: 'ok', timestamp: new Date().toISOString()};
});

async function startServer(): Promise<void> {
  try {
    // Register security plugins
    await registerSecurityPlugins();

    // Initialize OIDC
    await initializeOIDC();

    // Read GraphQL schema
    const typeDefs = readFileSync(join(__dirname, 'schema', 'schema.graphql'), 'utf-8');

    // Create Apollo Server
    const server = new ApolloServer<GraphQLContext | Record<string, never>>({
      typeDefs,
      resolvers: {
        ...resolvers,
        DateTime,
        Decimal,
        Upload,
      },
      // Disable introspection in production for security
      introspection: process.env.NODE_ENV !== 'production',
      plugins: [
        fastifyApolloDrainPlugin(fastify),
        {
          requestDidStart(): {
            didEncounterErrors: (requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>) => void;
          } {
            return {
              didEncounterErrors(
                requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
              ): void {
                // Format custom errors properly
                if (requestContext.errors) {
                  requestContext.errors.forEach((error) => {
                    if (error.originalError instanceof AppError) {
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
            };
          },
        },
      ],
      formatError: (error): GraphQLError => {
        // Don't expose internal errors in production
        if (process.env.NODE_ENV === 'production') {
          if (error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
            return new GraphQLError('Internal server error', {
              extensions: {
                code: 'INTERNAL_SERVER_ERROR',
              },
            });
          }
        }

        // Return formatted error with extensions
        return error;
      },
    });

    await server.start();

    // Register Apollo with Fastify
    // Context is passed as part of the plugin options
    await fastify.register(fastifyApollo(server), {
      context: async (request: FastifyRequest) => {
        const context = await createContext(request);
        // Return empty object if context is null (for introspection)
        return (context ?? {}) as GraphQLContext | Record<string, never>;
      },
    } as Parameters<typeof fastify.register>[1]);

    // Start server
    const port = Number(process.env.PORT) || 4000;
    await fastify.listen({port, host: '0.0.0.0'});

    fastify.log.info(`🚀 Server ready at http://localhost:${port}/graphql`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  void (async (): Promise<void> => {
    await disconnectPrisma();
    await fastify.close();
    process.exit(0);
  })();
});

process.on('SIGINT', () => {
  void (async (): Promise<void> => {
    await disconnectPrisma();
    await fastify.close();
    process.exit(0);
  })();
});

void startServer();


