/**
 * Database Connection Pool Monitoring
 * Provides metrics and health checks for database connection pool
 */

import { Client } from 'pg';
import { logInfo, logWarn, logError } from './logger';
import { config } from '../config';

/**
 * Pool metrics interface
 */
export interface PoolMetrics {
  /** Maximum pool size */
  maxConnections: number;
  /** Current active connections (estimated) */
  activeConnections: number;
  /** Current idle connections (estimated) */
  idleConnections: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: number;
  /** Idle timeout in milliseconds */
  idleTimeoutMs: number;
  /** Pool utilization percentage */
  utilizationPercent: number;
}

/**
 * Get a database client for database operations
 * Uses a direct Client connection instead of the pool to avoid connection issues
 * The pool may have connection string issues in Docker, so we create a fresh client
 */
async function getDbClient(maxRetries = 5, delayMs = 1000): Promise<Client> {
  // config.database.url already has adjusted hostname via getter
  const connectionString = config.database.url;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      return client;
    } catch (error) {
      try {
        await client.end();
      } catch {
        // Ignore cleanup errors
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to get database client after retries');
}

/**
 * Get database connection pool metrics
 * @returns Pool metrics
 */
export async function getPoolMetrics(): Promise<PoolMetrics> {
  try {
    const dbConfig = config.database;

    // Execute a simple query to check pool health
    // Use direct pg.Client instead of prisma.$queryRaw (PrismaPg adapter doesn't support it)
    const startTime = Date.now();
    const client = await getDbClient();
    try {
      await client.query('SELECT 1');
    } finally {
      await client.end();
    }
    const queryTime = Date.now() - startTime;

    // Note: Prisma doesn't expose direct pool metrics
    // These are estimated based on configuration
    // For accurate metrics, you would need to query PostgreSQL's pg_stat_activity
    const metrics: PoolMetrics = {
      maxConnections: dbConfig.poolMax,
      activeConnections: 0, // Would need pg_stat_activity query
      idleConnections: 0, // Would need pg_stat_activity query
      connectionTimeoutMs: dbConfig.connectionTimeoutMs,
      idleTimeoutMs: dbConfig.idleTimeoutMs,
      utilizationPercent: 0, // Would need actual connection count
    };

    // Log slow queries
    if (queryTime > 100) {
      logWarn('Slow database query detected', {
        queryTimeMs: queryTime,
        threshold: 100,
      });
    }

    return metrics;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError(
      'Failed to get pool metrics',
      {
        event: 'pool_metrics_failed',
      },
      errorObj
    );
    throw errorObj;
  }
}

/**
 * Get detailed pool statistics from PostgreSQL
 * Requires querying pg_stat_activity and pg_settings
 * @returns Detailed pool statistics
 */
export async function getDetailedPoolStats(): Promise<{
  maxConnections: number;
  currentConnections: number;
  activeQueries: number;
  idleConnections: number;
  poolConfig: {
    max: number;
    connectionTimeoutMs: number;
    idleTimeoutMs: number;
  };
}> {
  try {
    // Use direct pg.Client instead of prisma.$queryRaw (PrismaPg adapter doesn't support it)
    const client = await getDbClient();
    try {
      // Get PostgreSQL max_connections setting
      const maxConnResult = await client.query<{ setting: string }>(
        "SELECT setting FROM pg_settings WHERE name = 'max_connections'"
      );
      const maxConnections = maxConnResult.rows[0]
        ? Number.parseInt(maxConnResult.rows[0].setting, 10)
        : 100;

      // Get current connection count
      const connCountResult = await client.query<{ count: bigint }>(
        'SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()'
      );
      const currentConnections = Number(connCountResult.rows[0]?.count ?? 0);

      // Get active queries
      const activeQueriesResult = await client.query<{ count: bigint }>(
        "SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database() AND state = 'active'"
      );
      const activeQueries = Number(activeQueriesResult.rows[0]?.count ?? 0);

      // Get idle connections
      const idleConnections = currentConnections - activeQueries;

      return {
        maxConnections,
        currentConnections,
        activeQueries,
        idleConnections,
        poolConfig: {
          max: config.database.poolMax,
          connectionTimeoutMs: config.database.connectionTimeoutMs,
          idleTimeoutMs: config.database.idleTimeoutMs,
        },
      };
    } finally {
      await client.end();
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError(
      'Failed to get detailed pool stats',
      {
        event: 'pool_stats_failed',
      },
      errorObj
    );
    throw errorObj;
  }
}

/**
 * Check pool health
 * @returns Health status
 */
export async function checkPoolHealth(): Promise<{
  healthy: boolean;
  metrics: PoolMetrics;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const metrics = await getPoolMetrics();

  // Check utilization
  if (metrics.utilizationPercent > 80) {
    warnings.push(`High pool utilization: ${metrics.utilizationPercent}%`);
  }

  // Check connection timeout
  if (metrics.connectionTimeoutMs < 5000) {
    warnings.push(
      'Connection timeout is very low, may cause connection failures under load'
    );
  }

  // Check idle timeout
  if (metrics.idleTimeoutMs < 10000) {
    warnings.push(
      'Idle timeout is very low, connections may be closed too frequently'
    );
  }

  const healthy = warnings.length === 0;

  if (!healthy) {
    logWarn('Pool health check found issues', {
      warnings: warnings.join(', '),
      metrics: JSON.stringify(metrics),
    });
  }

  return {
    healthy,
    metrics,
    warnings,
  };
}

/**
 * Log pool metrics periodically
 * Call this from a cron job or health check endpoint
 */
export async function logPoolMetrics(): Promise<void> {
  try {
    const stats = await getDetailedPoolStats();
    const utilization =
      stats.maxConnections > 0
        ? (stats.currentConnections / stats.maxConnections) * 100
        : 0;

    logInfo('Database pool metrics', {
      event: 'pool_metrics',
      maxConnections: stats.maxConnections,
      currentConnections: stats.currentConnections,
      activeQueries: stats.activeQueries,
      idleConnections: stats.idleConnections,
      utilizationPercent: Math.round(utilization * 100) / 100,
      poolMax: stats.poolConfig.max,
      connectionTimeoutMs: stats.poolConfig.connectionTimeoutMs,
      idleTimeoutMs: stats.poolConfig.idleTimeoutMs,
    });

    // Warn if utilization is high
    if (utilization > 80) {
      logWarn('High database pool utilization', {
        utilizationPercent: Math.round(utilization * 100) / 100,
        currentConnections: stats.currentConnections,
        maxConnections: stats.maxConnections,
      });
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError(
      'Failed to log pool metrics',
      {
        event: 'pool_metrics_log_failed',
      },
      errorObj
    );
  }
}
