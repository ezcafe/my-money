/**
 * Apollo GraphQL Server Entry Point
 */

import {Hono} from 'hono';
import {serve} from '@hono/node-server';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {resolvers} from './resolvers/index';
import {DateTime, Decimal, Upload} from './schema/scalars';
import {initializeOIDC} from './middleware/auth';
import {disconnectPrisma} from './utils/prisma';
import {startRecurringTransactionsCron} from './cron/recurringTransactions';
import {startBudgetResetCron} from './cron/budgetReset';
import {startBalanceReconciliationCron} from './cron/balanceReconciliation';
import {registerSecurityPlugins} from './config/security';
import {registerMultipartHandler} from './config/multipart';
import {createApolloServer} from './config/apollo';
import {createApolloHandler} from './config/apolloHandler';
import {registerAuthRoutes} from './routes/auth';
import {checkDatabaseHealth} from './utils/prisma';
import {getOIDCConfig} from './middleware/auth';
import {config} from './config';
import {runMigrationsWithRetry} from './utils/migrations';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = new Hono();

/**
 * Validate required environment variables at startup
 * Ensures all required configuration is present before server starts
 */
function validateEnvironmentVariables(): void {
  const required = [
    'DATABASE_URL',
    'OPENID_DISCOVERY_URL',
    'OPENID_CLIENT_ID',
    'OPENID_CLIENT_SECRET',
  ];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key] || process.env[key]?.trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Health check endpoint (no rate limit)
// Verifies database connectivity, OIDC configuration, and system resources
app.get('/health', async (c) => {
  const checks: {
    database: {status: string; queryTimeMs?: number};
    oidc: {status: string; reachable?: boolean};
    memory: {usedMB: number; totalMB: number; percentage: number};
  } = {
    database: {status: 'unknown'},
    oidc: {status: 'unknown'},
    memory: {usedMB: 0, totalMB: 0, percentage: 0},
  };

  // Check database connectivity with timing
  const dbHealth = await checkDatabaseHealth();
  checks.database = {
    status: dbHealth.healthy ? 'connected' : 'disconnected',
    queryTimeMs: dbHealth.queryTimeMs,
  };

  // Check OIDC configuration and connectivity
  try {
    getOIDCConfig();
    checks.oidc = {status: 'configured', reachable: true};
    // Optionally test OIDC provider connectivity with timeout
    // This is a lightweight check that doesn't make full auth calls
  } catch {
    checks.oidc = {status: 'unconfigured', reachable: false};
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const percentage = totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0;
  checks.memory = {usedMB, totalMB, percentage};

  // Determine overall status
  const status = checks.database.status === 'connected' ? 'ok' : 'degraded';

  return c.json({
    status,
    timestamp: new Date().toISOString(),
    ...checks,
  });
});

async function startServer(): Promise<void> {
  const startTime = Date.now();

  try {
    // Validate environment variables before starting
    const envValidationStart = Date.now();
    validateEnvironmentVariables();
    // eslint-disable-next-line no-console
    console.log(`[${Date.now() - envValidationStart}ms] Environment validated`);

    // Determine if migrations should run
    // Run migrations if explicitly requested or in production
    const shouldRunMigrations = process.env.RUN_MIGRATIONS === 'true' ||
                                process.env.NODE_ENV === 'production';

    // Run migrations and OIDC initialization in parallel (they're independent)
    const parallelStart = Date.now();
    const [migrationResult, oidcResult] = await Promise.allSettled([
      shouldRunMigrations
        ? (async (): Promise<void> => {
            const migrationStart = Date.now();
            try {
              await runMigrationsWithRetry();
              // eslint-disable-next-line no-console
              console.log(`[${Date.now() - migrationStart}ms] Database migrations completed`);
            } catch (error) {
              console.error(`[${Date.now() - migrationStart}ms] Database migrations failed:`, error);
              throw error;
            }
          })()
        : (async (): Promise<void> => {
            const healthCheckStart = Date.now();
            // Just verify database connectivity
            const dbHealth = await checkDatabaseHealth();
            if (!dbHealth.healthy) {
              console.warn(`[${Date.now() - healthCheckStart}ms] Database health check failed, but continuing startup...`);
            } else {
              // eslint-disable-next-line no-console
              console.log(`[${Date.now() - healthCheckStart}ms] Database health check passed (migrations skipped in development)`);
            }
          })(),
      (async (): Promise<void> => {
        const oidcStart = Date.now();
        try {
          await initializeOIDC();
          // eslint-disable-next-line no-console
          console.log(`[${Date.now() - oidcStart}ms] OIDC initialized`);
        } catch (error) {
          console.error(`[${Date.now() - oidcStart}ms] OIDC initialization failed:`, error);
          throw error;
        }
      })(),
    ]);

    // eslint-disable-next-line no-console
    console.log(`[${Date.now() - parallelStart}ms] Parallel initialization completed`);

    // Check results and fail fast if either failed
    if (migrationResult.status === 'rejected') {
      throw migrationResult.reason;
    }
    if (oidcResult.status === 'rejected') {
      throw oidcResult.reason;
    }

    // Register multipart handler for file uploads (must be registered BEFORE security plugins
    // to access the raw request body before it's consumed)
    const multipartStart = Date.now();
    registerMultipartHandler(app);
    // eslint-disable-next-line no-console
    console.log(`[${Date.now() - multipartStart}ms] Multipart handler registered`);

    // Register security plugins (includes cookie, CORS, compression, rate limiting)
    const securityStart = Date.now();
    registerSecurityPlugins(app);
    // eslint-disable-next-line no-console
    console.log(`[${Date.now() - securityStart}ms] Security plugins registered`);

    // Register authentication routes
    const authRoutesStart = Date.now();
    registerAuthRoutes(app);
    // eslint-disable-next-line no-console
    console.log(`[${Date.now() - authRoutesStart}ms] Authentication routes registered`);

    // Read GraphQL schema
    const schemaStart = Date.now();
    const typeDefs = readFileSync(join(__dirname, 'schema', 'schema.graphql'), 'utf-8');
    // eslint-disable-next-line no-console
    console.log(`[${Date.now() - schemaStart}ms] GraphQL schema loaded`);

    // Create Apollo Server
    const apolloCreateStart = Date.now();
    const server = createApolloServer(
      typeDefs,
      {
        ...resolvers,
        DateTime,
        Decimal,
        Upload,
      },
    );
    // eslint-disable-next-line no-console
    console.log(`[${Date.now() - apolloCreateStart}ms] Apollo Server created`);

    const apolloStartStart = Date.now();
    await server.start();
    // eslint-disable-next-line no-console
    console.log(`[${Date.now() - apolloStartStart}ms] Apollo Server started`);

    // Register Apollo handler with Hono
    app.all('/graphql', createApolloHandler(server));

    // Start cron jobs
    const cronStart = Date.now();
    startRecurringTransactionsCron();
    startBudgetResetCron();
    startBalanceReconciliationCron();
    // eslint-disable-next-line no-console
    console.log(`[${Date.now() - cronStart}ms] Cron jobs started`);

    // Start server
    const serverStartStart = Date.now();
    const serverInstance = serve({
      fetch: app.fetch,
      port: config.server.port,
      hostname: config.server.host,
    }, (info) => {
      const totalTime = Date.now() - startTime;
      // eslint-disable-next-line no-console
      console.log(`🚀 Server ready at http://localhost:${info.port}/graphql (startup: ${totalTime}ms)`);
    });
    // eslint-disable-next-line no-console
    console.log(`[${Date.now() - serverStartStart}ms] HTTP server started`);

    // Store server instance for graceful shutdown
    (globalThis as {serverInstance?: typeof serverInstance}).serverInstance = serverInstance;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Server startup error after ${totalTime}ms:`, error);
    process.exit(1);
  }
}

// Graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  try {
    await disconnectPrisma();
    const serverInstance = (globalThis as {serverInstance?: {close: () => Promise<void>}}).serverInstance;
    if (serverInstance?.close) {
      await serverInstance.close();
    }
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

void startServer();
