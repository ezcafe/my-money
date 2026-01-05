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
import type {GraphQLRequestContext, GraphQLRequestListener} from '@apollo/server';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import {startRecurringTransactionsCron} from './cron/recurringTransactions';
import {startBudgetResetCron} from './cron/budgetReset';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  logger: true,
  // Set body size limits to prevent large GraphQL queries from consuming too much memory
  bodyLimit: 2 * 1024 * 1024, // 2MB for GraphQL queries (JSON)
  // Note: File uploads are handled separately via multipart plugin with 10MB limit
});

// Register security plugins
async function registerSecurityPlugins(): Promise<void> {
  // CORS configuration - allow frontend to communicate with backend
  // Configured via CORS_ORIGIN environment variable (comma-separated list of allowed origins)
  // Defaults to localhost:3000 for development
  // Example: CORS_ORIGIN=http://localhost:3000,https://example.com
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  await fastify.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    // Allow multipart/form-data
    exposedHeaders: ['Content-Type'],
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

  // Stricter rate limiting for file upload operations (uploadPDF, importCSV)
  // These operations are resource-intensive and should have lower limits
  fastify.addHook('onRequest', async (request, _reply) => {
    const body = request.body as {query?: string; variables?: Record<string, unknown>} | undefined;
    if (body?.query?.includes('uploadPDF') || body?.query?.includes('importCSV')) {
      // Apply stricter rate limit: 5 uploads per minute per user
      // This is handled per-user via the general rate limit, but we can add
      // additional checks here if needed. For now, the general rate limit applies.
      // In production, consider implementing per-user rate limiting with Redis
    }
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
    // Register multipart plugin for file uploads (must be registered before Apollo)
    await fastify.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
    });

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

    await server.start();

    // Add hook to process GraphQL multipart requests (file uploads)
    // This processes the multipart request and converts it to the format Apollo Server expects
    fastify.addHook('preHandler', async (request, reply) => {
      // Only process GraphQL POST requests that are multipart
      // Skip if already processed or not multipart
      if (request.url === '/graphql' && request.method === 'POST' && request.isMultipart()) {
        try {
          const operations: {query?: string; variables?: Record<string, unknown>} = {};
          const map: Record<string, string[]> = {};
          const files: Record<string, {filename: string; mimetype?: string; encoding?: string; createReadStream: () => NodeJS.ReadableStream}> = {};

          const parts = request.parts();

          for await (const part of parts) {
            if (part.type === 'file') {
              // Consume file stream into buffer to allow iterator to continue
              const chunks: Buffer[] = [];
              for await (const chunk of part.file) {
                chunks.push(chunk as Buffer);
              }
              const fileBuffer = Buffer.concat(chunks);
              // Store file data with createReadStream that returns a stream from the buffer
              const {Readable} = await import('stream');
              files[part.fieldname] = {
                filename: part.filename ?? 'unknown',
                mimetype: part.mimetype,
                encoding: part.encoding,
                createReadStream: () => Readable.from(fileBuffer),
              };
            } else {
              // Parse operations and map fields
              let value: string;
              // For field parts, check if part has a toBuffer method or value property
              const partWithBuffer = part as unknown as {toBuffer?: () => Promise<Buffer>};
              if (typeof partWithBuffer.toBuffer === 'function') {
                const buffer = await partWithBuffer.toBuffer();
                value = buffer.toString('utf-8');
              } else {
                const partWithValue = part as unknown as {value?: string};
                if (partWithValue.value) {
                  value = partWithValue.value;
                } else {
                  // Fallback: read from part as stream (part itself should be iterable for field parts)
                  const chunks: Buffer[] = [];
                  const partAsIterable = part as unknown as AsyncIterable<Buffer>;
                  for await (const chunk of partAsIterable) {
                    chunks.push(chunk);
                  }
                  value = Buffer.concat(chunks).toString('utf-8');
                }
              }

              if (part.fieldname === 'operations') {
                Object.assign(operations, JSON.parse(value));
              } else if (part.fieldname === 'map') {
                Object.assign(map, JSON.parse(value));
              }
            }
          }

          // Replace file placeholders in operations.variables with actual file promises
          if (operations.variables && typeof operations.variables === 'object') {
            const variables = operations.variables as Record<string, unknown>;
            for (const [fileKey, filePaths] of Object.entries(map)) {
              // fileKey is the file part fieldname (e.g., "0"), filePaths is array of variable paths (e.g., ["file"])
              if (Array.isArray(filePaths) && filePaths.length > 0 && files[fileKey]) {
                const variablePath = filePaths[0]; // e.g., "file"
                if (!variablePath) {
                  continue;
                }
                const pathParts = variablePath.split('.');
                let current: Record<string, unknown> = variables;
                for (let i = 0; i < pathParts.length - 1; i++) {
                  const key = pathParts[i];
                  if (!key) {
                    continue;
                  }
                  if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                  }
                  current = current[key] as Record<string, unknown>;
                }
                const lastKey = pathParts[pathParts.length - 1];
                if (lastKey) {
                  current[lastKey] = Promise.resolve(files[fileKey]);
                }
              }
            }
          }

          // Store file promises in request context so they're accessible to resolvers
          // The file promises are already in operations.variables, so we just need to ensure
          // the body is set correctly for Apollo Server
          request.body = operations;

          // Store files in request for potential access
          (request as {uploadFiles?: typeof files}).uploadFiles = files;
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          fastify.log.error({err: errorObj}, 'Error processing multipart GraphQL request');
          return reply.code(400).send({errors: [{message: 'Failed to process file upload'}]});
        }
      }
    });

    // Register Apollo with Fastify
    // Context is passed as part of the plugin options
    await fastify.register(fastifyApollo(server), {
      context: async (request: FastifyRequest) => {
        const context = await createContext(request);
        // Return empty object if context is null (for introspection)
        return (context ?? {}) as GraphQLContext | Record<string, never>;
      },
    } as Parameters<typeof fastify.register>[1]);

    // Start cron jobs
    startRecurringTransactionsCron();
    startBudgetResetCron();

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

