/**
 * Apollo GraphQL Server Entry Point
 */

import 'reflect-metadata';
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
import {startCacheCleanupCron} from './cron/cacheCleanup';
import {startBackupCron} from './cron/backup';
import {startDataArchivalCron} from './cron/dataArchival';
import {registerSecurityPlugins} from './config/security';
import {registerMultipartHandler} from './config/multipart';
import {createApolloServer} from './config/apollo';
import {createApolloHandler} from './config/apolloHandler';
import {createSubscriptionServer} from './config/subscriptions';
import {makeExecutableSchema} from '@graphql-tools/schema';
import {registerAuthRoutes} from './routes/auth';
import {checkDatabaseHealth} from './utils/prisma';
import {getOIDCConfig} from './middleware/auth';
import {config} from './config';
import {runMigrationsWithRetry} from './utils/migrations';
import {startDatabaseListener, stopDatabaseListener} from './utils/databaseListener';
import {logInfo, logError, logWarn} from './utils/logger';

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

// Nonce endpoint - returns CSP nonce for current request
// Frontend can use this to set nonce attributes on dynamically created scripts/styles
app.get('/api/nonce', async (c) => {
  // Get nonce from context (set by securityHeaders middleware)
  // Use get() with proper typing for Hono context
  const nonce = (c.get('nonce' as never) as string | undefined);
  if (!nonce) {
    // Generate nonce if not already set (shouldn't happen if middleware is registered)
    const {randomBytes} = await import('crypto');
    const generatedNonce = randomBytes(16).toString('base64');
    c.set('nonce' as never, generatedNonce);
    return c.json({nonce: generatedNonce});
  }
  return c.json({nonce});
});

// Health check endpoint (no rate limit)
// Verifies database connectivity, OIDC configuration, and system resources
app.get('/health', async (c) => {
  const checks: {
    database: {status: string; queryTimeMs?: number};
    oidc: {status: string; reachable?: boolean};
    memory: {usedMB: number; totalMB: number; percentage: number};
    pool?: {maxConnections: number; currentConnections: number; utilizationPercent: number};
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

  // Check pool metrics if database is healthy
  if (dbHealth.healthy) {
    try {
      const {getDetailedPoolStats} = await import('./utils/poolMonitoring');
      const poolStats = await getDetailedPoolStats();
      const utilization = poolStats.maxConnections > 0
        ? (poolStats.currentConnections / poolStats.maxConnections) * 100
        : 0;
      checks.pool = {
        maxConnections: poolStats.maxConnections,
        currentConnections: poolStats.currentConnections,
        utilizationPercent: Math.round(utilization * 100) / 100,
      };
    } catch {
      // Ignore pool stats errors in health check
    }
  }

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
    logInfo('Environment validated', {
      durationMs: Date.now() - envValidationStart,
      event: 'startup_environment_validation',
    });

    // Run migrations and OIDC initialization in parallel (they're independent)
    const parallelStart = Date.now();
    const [migrationResult, oidcResult] = await Promise.allSettled([
      (async (): Promise<void> => {
        const migrationStart = Date.now();
        try {
          await runMigrationsWithRetry();
          logInfo('Database migrations completed', {
            durationMs: Date.now() - migrationStart,
            event: 'startup_migrations_completed',
          });
        } catch (error) {
          logError('Database migrations failed', {
            durationMs: Date.now() - migrationStart,
            event: 'startup_migrations_failed',
          }, error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      })(),
      (async (): Promise<void> => {
        const oidcStart = Date.now();
        try {
          await initializeOIDC();
          logInfo('OIDC initialized', {
            durationMs: Date.now() - oidcStart,
            event: 'startup_oidc_initialized',
          });
        } catch (error) {
          logError('OIDC initialization failed', {
            durationMs: Date.now() - oidcStart,
            event: 'startup_oidc_failed',
          }, error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      })(),
    ]);

    logInfo('Parallel initialization completed', {
      durationMs: Date.now() - parallelStart,
      event: 'startup_parallel_init_completed',
    });

    // Check results - migrations are critical, OIDC can fail gracefully in development
    if (migrationResult.status === 'rejected') {
      throw migrationResult.reason;
    }
    if (oidcResult.status === 'rejected') {
      const isDevelopment = process.env.NODE_ENV !== 'production';
      if (isDevelopment) {
        logWarn('OIDC initialization failed, but continuing in development mode. Authentication may not work until OIDC is available.', {
          event: 'startup_oidc_failed_development',
          error: oidcResult.reason instanceof Error ? oidcResult.reason.message : String(oidcResult.reason),
        });
      } else {
        // In production, OIDC is required
        throw oidcResult.reason;
      }
    }

    // Initialize cache, rate limit, and token revocation tables (after migrations)
    const cacheInitStart = Date.now();
    try {
      const {initializeCacheTables} = await import('./utils/postgresCache');
      const {initializeRateLimitTables} = await import('./utils/postgresRateLimiter');
      const {initializeTokenRevocationTable, clearAllRevocations} = await import('./utils/tokenRevocation');
      await Promise.all([
        initializeCacheTables(),
        initializeRateLimitTables(),
        initializeTokenRevocationTable(),
      ]);
      // Clear all token revocations on startup since we've disabled token revocation
      // This ensures we start with a clean slate and removes any old revoked tokens
      const clearedCount = await clearAllRevocations();
      if (clearedCount > 0) {
        logInfo('Cleared old token revocations on startup', {
          event: 'startup_token_revocation_cleared',
          clearedCount,
        });
      }
      logInfo('Cache, rate limit, and token revocation tables initialized', {
        durationMs: Date.now() - cacheInitStart,
        event: 'startup_cache_tables_initialized',
      });
    } catch (error) {
      logError('Cache tables initialization failed', {
        durationMs: Date.now() - cacheInitStart,
        event: 'startup_cache_tables_failed',
      }, error instanceof Error ? error : new Error(String(error)));
      // Don't throw - cache tables are optional and can be created later
    }

    // Start database listener for NOTIFY events (after migrations)
    const dbListenerStart = Date.now();
    try {
      await startDatabaseListener();
      logInfo('Database listener started', {
        durationMs: Date.now() - dbListenerStart,
        event: 'startup_database_listener_started',
      });
    } catch (error) {
      logError('Database listener startup failed', {
        durationMs: Date.now() - dbListenerStart,
        event: 'startup_database_listener_failed',
      }, error instanceof Error ? error : new Error(String(error)));
      // Don't throw - database listener is optional and can be started later
      // Events will still work from application-level emitters
    }

    // Register multipart handler for file uploads (must be registered BEFORE security plugins
    // to access the raw request body before it's consumed)
    const multipartStart = Date.now();
    registerMultipartHandler(app);
    logInfo('Multipart handler registered', {
      durationMs: Date.now() - multipartStart,
      event: 'startup_multipart_handler_registered',
    });

    // Register security plugins (includes cookie, CORS, compression, rate limiting)
    const securityStart = Date.now();
    registerSecurityPlugins(app);
    logInfo('Security plugins registered', {
      durationMs: Date.now() - securityStart,
      event: 'startup_security_plugins_registered',
    });

    // Register authentication routes
    const authRoutesStart = Date.now();
    registerAuthRoutes(app);
    logInfo('Authentication routes registered', {
      durationMs: Date.now() - authRoutesStart,
      event: 'startup_auth_routes_registered',
    });

    // Read GraphQL schema
    const schemaStart = Date.now();
    const typeDefs = readFileSync(join(__dirname, 'schema', 'schema.graphql'), 'utf-8');
    logInfo('GraphQL schema loaded', {
      durationMs: Date.now() - schemaStart,
      event: 'startup_schema_loaded',
    });

    // Build executable schema for subscriptions
    const allResolvers = {
      ...resolvers,
      DateTime,
      Decimal,
      Upload,
    };
    const executableSchema = makeExecutableSchema({
      typeDefs,
      resolvers: allResolvers,
    });

    // Create Apollo Server
    const apolloCreateStart = Date.now();
    const server = createApolloServer(
      typeDefs,
      allResolvers,
    );
    logInfo('Apollo Server created', {
      durationMs: Date.now() - apolloCreateStart,
      event: 'startup_apollo_server_created',
    });

    const apolloStartStart = Date.now();
    await server.start();
    logInfo('Apollo Server started', {
      durationMs: Date.now() - apolloStartStart,
      event: 'startup_apollo_server_started',
    });

    // Register Apollo handler with Hono
    app.all('/graphql', createApolloHandler(server));

    // Start cron jobs
    const cronStart = Date.now();
    startRecurringTransactionsCron();
    startBudgetResetCron();
    startBalanceReconciliationCron();
    startCacheCleanupCron();
    startBackupCron();
    startDataArchivalCron();
    logInfo('Cron jobs started', {
      durationMs: Date.now() - cronStart,
      event: 'startup_cron_jobs_started',
    });

    // Start HTTP server
    const serverStartStart = Date.now();
    const serverInstance = serve({
      fetch: app.fetch,
      port: config.server.port,
      hostname: config.server.host,
    }, (info) => {
      const totalTime = Date.now() - startTime;
      logInfo('Server ready', {
        totalStartupTimeMs: totalTime,
        port: info.port,
        graphqlUrl: `http://localhost:${info.port}/graphql`,
        wsUrl: `ws://localhost:${info.port}/graphql-ws`,
        event: 'startup_server_ready',
      });
    });
    logInfo('HTTP server started', {
      durationMs: Date.now() - serverStartStart,
      event: 'startup_http_server_started',
    });

    // Create WebSocket server for GraphQL subscriptions
    const wsStart = Date.now();
    const wsServer = createSubscriptionServer(executableSchema, serverInstance);
    logInfo('WebSocket server created', {
      durationMs: Date.now() - wsStart,
      event: 'startup_websocket_server_created',
    });

    // Store server instances for graceful shutdown
    (globalThis as {serverInstance?: typeof serverInstance; wsServer?: typeof wsServer}).serverInstance = serverInstance;
    (globalThis as {serverInstance?: typeof serverInstance; wsServer?: typeof wsServer}).wsServer = wsServer;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logError('Server startup error', {
      totalStartupTimeMs: totalTime,
      event: 'startup_failed',
    }, error instanceof Error ? error : new Error(String(error)));
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
    // Stop database listener
    await stopDatabaseListener();

    await disconnectPrisma();

    // Close WebSocket server first
    const wsServer = (globalThis as {wsServer?: {close: () => void}}).wsServer;
    if (wsServer?.close) {
      wsServer.close();
    }

    const serverInstance = (globalThis as {serverInstance?: {close: () => Promise<void>}}).serverInstance;
    if (serverInstance?.close) {
      await serverInstance.close();
    }
    process.exit(0);
  } catch (error) {
    logError('Error during shutdown', {
      event: 'shutdown_error',
    }, error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

void startServer();
