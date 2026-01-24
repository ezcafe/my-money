/**
 * Prisma client singleton
 * Ensures only one instance of PrismaClient is created
 * Configured with connection pooling and best practices
 *
 * Prisma 7+ requires using an adapter for database connections
 */

import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {Pool} from 'pg';
import {retry, isRetryableError} from './retry';
import {executeWithCircuitBreaker} from './circuitBreaker';
import {logError} from './logger';
import {config} from '../config';

interface GlobalForPrisma {

  prisma: PrismaClient | undefined;
}

const globalForPrisma = globalThis as unknown as GlobalForPrisma;

/**
 * Connection pool configuration
 * Best practices for connection pooling:
 * - connection_limit: Maximum number of connections in the pool (default: 100)
 * - pool_timeout: Maximum time to wait for a connection (default: 20 seconds)
 * - connect_timeout: Maximum time to establish a connection (default: 10 seconds)
 *
 * Configuration priority:
 * 1. Environment variables (DB_POOL_MAX, DB_CONNECTION_TIMEOUT_MS, DB_IDLE_TIMEOUT_MS)
 * 2. DATABASE_URL query parameters
 * 3. Default values
 *
 * Note: These can also be configured via DATABASE_URL query parameters:
 * DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=100&pool_timeout=20&connect_timeout=10"
 */
/**
 * Prisma Client with query timeout configuration
 *
 * Query timeouts can be configured at multiple levels:
 * 1. Database connection level: Add ?connect_timeout=10&command_timeout=30 to DATABASE_URL
 * 2. Transaction level: Use $transaction with timeout option
 *    Example: await prisma.$transaction(async (tx) => { ... }, { timeout: 30000 })
 * 3. Connection pool: Configure via environment variables or DATABASE_URL parameters
 *    Example: DB_POOL_MAX=100 DB_CONNECTION_TIMEOUT_MS=10000
 *
 * Recommended configuration:
 * - Environment variables: DB_POOL_MAX=100, DB_CONNECTION_TIMEOUT_MS=10000, DB_IDLE_TIMEOUT_MS=30000
 * - Or DATABASE_URL: postgresql://user:pass@host:5432/db?connection_limit=100&pool_timeout=20&connect_timeout=10&command_timeout=30000
 */

// Create PostgreSQL pool using centralized configuration
export const pool = new Pool({
  connectionString: config.database.url,
  max: config.database.poolMax,
  connectionTimeoutMillis: config.database.connectionTimeoutMs,
  idleTimeoutMillis: config.database.idleTimeoutMs,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // Connection pool settings and timeouts are configured via DATABASE_URL query parameters
    // See documentation above for recommended timeout values
  });

if (process.env.NODE_ENV !== 'production') {

  globalForPrisma.prisma = prisma;
}

/**
 * Execute a database operation with retry logic and circuit breaker
 * @param operation - Database operation to execute
 * @param context - Context for error logging
 * @returns Result of the operation
 */
export async function executeDbOperation<T>(
  operation: () => Promise<T>,
  context?: {operation?: string; resource?: string},
): Promise<T> {
  try {
    // First, check circuit breaker
    return await executeWithCircuitBreaker(async () => {
      // Then apply retry logic for retryable errors
      return await retry(operation, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        retryableErrors: isRetryableError,
      });
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Database operation failed', {
      event: 'database_operation_failed',
      ...context,
    }, errorObj);
    throw error;
  }
}

/**
 * Check database connection health with timing
 * @returns Object with health status and query time in milliseconds
 */
export async function checkDatabaseHealth(): Promise<{healthy: boolean; queryTimeMs?: number}> {
  const startTime = Date.now();
  try {
    await executeWithCircuitBreaker(async () => {
      // Use direct pg.Client instead of prisma.$queryRaw (PrismaPg adapter doesn't support it)
      const {Client} = await import('pg');
      // config.database.url already has adjusted hostname, but we use it directly here
      const connectionString = config.database.url;
      const client = new Client({connectionString});
      try {
        await client.connect();
        await client.query('SELECT 1');
      } finally {
        await client.end();
      }
    });
    const queryTimeMs = Date.now() - startTime;
    return {healthy: true, queryTimeMs};
  } catch {
    return {healthy: false};
  }
}

/**
 * Disconnect Prisma client
 * Should be called on application shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    // Close the connection pool
    await pool.end();
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Error disconnecting from database', {
      event: 'database_disconnect_error',
    }, errorObj);
  }
}


