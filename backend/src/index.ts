/**
 * Apollo GraphQL Server Entry Point
 */

import Fastify, {type FastifyRequest} from 'fastify';
import fastifyApollo from '@as-integrations/fastify';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {resolvers} from './resolvers/index';
import {DateTime, Decimal, Upload} from './schema/scalars';
import {createContext} from './middleware/context';
import type {GraphQLContext} from './middleware/context';
import {initializeOIDC} from './middleware/auth';
import {disconnectPrisma} from './utils/prisma';
import multipart from '@fastify/multipart';
import {startRecurringTransactionsCron} from './cron/recurringTransactions';
import {startBudgetResetCron} from './cron/budgetReset';
import {registerSecurityPlugins} from './config/security';
import {registerMultipartHandler} from './config/multipart';
import {createApolloServer} from './config/apollo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  logger: true,
  // Set body size limits to prevent large GraphQL queries from consuming too much memory
  bodyLimit: 2 * 1024 * 1024, // 2MB for GraphQL queries (JSON)
  // Note: File uploads are handled separately via multipart plugin with 10MB limit
});


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
    await registerSecurityPlugins(fastify);

    // Initialize OIDC
    await initializeOIDC();

    // Read GraphQL schema
    const typeDefs = readFileSync(join(__dirname, 'schema', 'schema.graphql'), 'utf-8');

    // Create Apollo Server
    const server = createApolloServer(
      typeDefs,
      {
        ...resolvers,
        DateTime,
        Decimal,
        Upload,
      },
      fastify,
    );

    await server.start();

    // Register multipart handler for file uploads
    registerMultipartHandler(fastify);

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

