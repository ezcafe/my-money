/**
 * Programmatic Database Schema Sync Runner
 * Syncs Prisma schema to database on application startup using Prisma's db push
 * This replaces migrations since all schema changes have been merged into the main schema
 */

import {execSync, spawn} from 'child_process';
import {join} from 'path';
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import {logError, logInfo, logWarn} from './logger';
import {adjustDatabaseConnectionString} from '../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration from environment variables (same as entrypoint script)
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES ?? '5', 10);
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY ?? '5', 10) * 1000; // Convert to milliseconds
const MIGRATION_TIMEOUT = parseInt(process.env.MIGRATION_TIMEOUT ?? '60', 10) * 1000; // Convert to milliseconds

/**
 * Wait for a specified duration
 * @param ms - Milliseconds to wait
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if database is accessible by validating Prisma schema
 * Uses Prisma client directly (no shell needed)
 * @returns True if database is accessible
 */
async function checkDatabaseAccessibility(): Promise<boolean> {
  try {
    // Import Prisma client and config dynamically to check connectivity
    const {Client} = await import('pg');
    const {config} = await import('../config');

    // config.database.url already has adjusted hostname via getter
    const connectionString = config.database.url;

    // Use direct pg.Client instead of prisma.$queryRaw (PrismaPg adapter doesn't support it)
    const client = new Client({connectionString});
    try {
      await client.connect();
      await client.query('SELECT 1');
      return true;
    } finally {
      await client.end();
    }
  } catch {
    return false;
  }
}

/**
 * Wait for database to be ready with retry logic
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelayMs - Delay between retries in milliseconds
 */
async function waitForDatabase(
  maxRetries: number = MAX_RETRIES,
  retryDelayMs: number = RETRY_DELAY,
): Promise<void> {
  logInfo('Waiting for database to be ready', {
    event: 'migration_waiting_for_database',
    maxRetries,
  });

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logInfo('Checking database connection', {
      event: 'migration_database_check',
      attempt,
      maxRetries,
    });

    if (await checkDatabaseAccessibility()) {
      logInfo('Database is ready', {
        event: 'migration_database_ready',
        attempt,
      });
      return;
    }

    if (attempt < maxRetries) {
      logInfo('Database not ready yet, waiting before retry', {
        event: 'migration_database_waiting',
        attempt,
        maxRetries,
        retryDelaySeconds: retryDelayMs / 1000,
      });
      await sleep(retryDelayMs);
    }
  }

  logWarn('Could not verify database connectivity, but proceeding with migration attempt', {
    event: 'migration_database_unverified',
    maxRetries,
    message: 'This is normal if database is starting up. Migration will retry on failure.',
  });
}

/**
 * Check if only cache and rate_limit tables are in the list
 * @param tableNames - Array of table names to check
 * @returns True if only cache and rate_limit tables are present
 */
function onlyCacheAndRateLimitTables(tableNames: string[]): boolean {
  const allowedTables = new Set(['cache', 'rate_limit']);
  return tableNames.length > 0 && tableNames.every((table) => allowedTables.has(table));
}

/**
 * Extract table names from Prisma's data loss warning message
 * @param output - The stderr/stdout output from prisma db push
 * @returns Array of table names that will be dropped, or empty array if none found
 */
function extractDroppedTableNames(output: string): string[] {
  const tableNames: string[] = [];
  // Match pattern: "You are about to drop the `table_name` table"
  const dataLossMatches = output.matchAll(/You are about to drop the `([^`]+)` table/gi);

  for (const match of dataLossMatches) {
    if (match[1]) {
      tableNames.push(match[1]);
    }
  }

  return tableNames;
}

/**
 * Run prisma db push with conditional auto-acceptance of data loss
 * Only auto-accepts if only cache and rate_limit tables are affected
 * @param backendPath - Path to backend directory
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that resolves when command completes
 */
async function runDbPushWithConditionalAccept(
  backendPath: string,
  timeoutMs: number,
): Promise<void> {
  // Adjust DATABASE_URL for the current environment before passing to Prisma CLI
  const databaseUrl = process.env.DATABASE_URL;
  const adjustedDatabaseUrl = databaseUrl ? adjustDatabaseConnectionString(databaseUrl) : undefined;

  const env = {
    ...process.env,
    ...(adjustedDatabaseUrl && {DATABASE_URL: adjustedDatabaseUrl}),
    PRISMA_SCHEMA_PATH: join(backendPath, 'prisma/schema.prisma'),
  };

  // First, run with output capture to check for data loss warnings
  const {stdout, stderr, exitCode} = await new Promise<{stdout: string; stderr: string; exitCode: number}>((resolve, reject) => {
    const child = spawn('npx', ['prisma', 'db', 'push'], {
      cwd: backendPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';
    let timeoutId: NodeJS.Timeout | null = null;

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        child.kill();
        reject(new Error('Command timed out'));
      }, timeoutMs);
    }

    child.stdout?.on('data', (data: Buffer) => {
      stdoutData += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderrData += data.toString();
    });

    child.on('close', (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve({stdout: stdoutData, stderr: stderrData, exitCode: code ?? 1});
    });

    child.on('error', (err) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(err);
    });
  });

  const allOutput = stdout + stderr;

  // If command succeeded, output the result and return
  if (exitCode === 0) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    return;
  }

  // Command failed - check if it's due to data loss warning
  if (allOutput.includes('There might be data loss') ||
      allOutput.includes('Use the --accept-data-loss flag')) {

    // Extract table names from the warning
    const droppedTables = extractDroppedTableNames(allOutput);

    // Only auto-accept if only cache and rate_limit tables are affected
    if (onlyCacheAndRateLimitTables(droppedTables)) {
      logInfo('Auto-accepting data loss for cache and rate_limit tables', {
        event: 'auto_accept_data_loss',
        tables: droppedTables.join(', '),
      });

      // Run again with --accept-data-loss flag and show output
      execSync('npx prisma db push --accept-data-loss', {
        cwd: backendPath,
        stdio: 'inherit',
        timeout: timeoutMs,
        env,
      });
      return;
    } else if (droppedTables.length > 0) {
      // Other tables will be dropped - show error and don't auto-accept
      process.stdout.write(stdout);
      process.stderr.write(stderr);
      logWarn('Data loss detected for tables other than cache/rate_limit', {
        event: 'data_loss_requires_manual_confirmation',
        tables: droppedTables.join(', '),
      });
      throw new Error(`Migration requires manual confirmation for data loss on tables: ${droppedTables.join(', ')}. Use --accept-data-loss flag if you want to proceed.`);
    }
  }

  // Different error - show output and throw
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  throw new Error(`Command failed with exit code ${exitCode}`);
}

/**
 * Sync Prisma schema to database
 * Uses db push in development, migrate deploy in production
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelayMs - Delay between retries in milliseconds
 * @param timeoutMs - Timeout for sync operation in milliseconds
 */
export async function runMigrations(
  maxRetries: number = MAX_RETRIES,
  retryDelayMs: number = RETRY_DELAY,
  timeoutMs: number = MIGRATION_TIMEOUT,
): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const backendPath = join(__dirname, '../..');

  if (isProduction) {
    logInfo('Running database migrations (production mode)', {
      event: 'migration_production_start',
      databaseUrlSet: process.env.DATABASE_URL ? 'yes' : 'no',
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logInfo('Migration deploy attempt', {
        event: 'migration_deploy_attempt',
        attempt,
        maxRetries,
      });

      try {
        // Adjust DATABASE_URL for the current environment before passing to Prisma CLI
        const databaseUrl = process.env.DATABASE_URL;
        const adjustedDatabaseUrl = databaseUrl ? adjustDatabaseConnectionString(databaseUrl) : undefined;

        // Use prisma migrate deploy in production
        // This applies pending migrations safely
        execSync('npx prisma migrate deploy', {
          cwd: backendPath,
          stdio: 'inherit',
          timeout: timeoutMs,
          env: {
            ...process.env,
            ...(adjustedDatabaseUrl && {DATABASE_URL: adjustedDatabaseUrl}),
            PRISMA_SCHEMA_PATH: join(backendPath, 'prisma/schema.prisma'),
          },
        });

        logInfo('Migrations deployed successfully', {
          event: 'migration_deploy_success',
          attempt,
        });
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const exitCode = (error && typeof error === 'object' && 'status' in error ? (error.status as number | string) : 1);
        const exitCodeNumber = typeof exitCode === 'string' ? Number.parseInt(exitCode, 10) : exitCode;

        logWarn('Migration deploy attempt failed', {
          event: 'migration_deploy_attempt_failed',
          attempt,
          maxRetries,
          exitCode: exitCodeNumber,
          error: errorMessage,
        });

        if (attempt < maxRetries) {
          logInfo('Waiting before retry', {
            event: 'migration_deploy_retry_wait',
            attempt,
            retryDelaySeconds: retryDelayMs / 1000,
          });
          await sleep(retryDelayMs);
        } else {
          logError('Migration deploy failed after all retries', {
            event: 'migration_deploy_failed',
            attempts: maxRetries,
            exitCode: exitCodeNumber,
          }, error instanceof Error ? error : new Error(errorMessage));
          throw new Error(`Migration deploy failed after ${maxRetries} attempts: ${errorMessage}`);
        }
      }
    }
  } else {
    // Development: use db push for faster iteration
    logInfo('Syncing database schema (development mode)', {
      event: 'migration_development_start',
      databaseUrlSet: process.env.DATABASE_URL ? 'yes' : 'no',
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logInfo('Schema sync attempt', {
        event: 'schema_sync_attempt',
        attempt,
        maxRetries,
      });

      try {
        // Use Prisma db push in development
        // This syncs the schema directly without requiring migrations
        // Auto-accepts data loss only if cache and rate_limit tables are affected
        await runDbPushWithConditionalAccept(backendPath, timeoutMs);

        logInfo('Schema sync completed successfully', {
          event: 'schema_sync_success',
          attempt,
        });
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const exitCode = (error && typeof error === 'object' && 'status' in error ? (error.status as number | string) : 1);
        const exitCodeNumber = typeof exitCode === 'string' ? Number.parseInt(exitCode, 10) : exitCode;

        logWarn('Schema sync attempt failed', {
          event: 'schema_sync_attempt_failed',
          attempt,
          maxRetries,
          exitCode: exitCodeNumber,
          error: errorMessage,
        });

        if (attempt < maxRetries) {
          logInfo('Waiting before retry', {
            event: 'schema_sync_retry_wait',
            attempt,
            retryDelaySeconds: retryDelayMs / 1000,
          });
          await sleep(retryDelayMs);
        } else {
          logError('Schema sync failed after all retries', {
            event: 'schema_sync_failed',
            attempts: maxRetries,
            exitCode: exitCodeNumber,
          }, error instanceof Error ? error : new Error(errorMessage));
          throw new Error(`Schema sync failed after ${maxRetries} attempts: ${errorMessage}`);
        }
      }
    }
  }
}

/**
 * Run schema sync with database readiness check
 * This is the main entry point for syncing schema on startup
 */
export async function runMigrationsWithRetry(): Promise<void> {
  try {
    // Wait for database to be ready
    await waitForDatabase();

    // Sync schema with retry logic
    await runMigrations();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError('Fatal error during schema sync process', {
      event: 'schema_sync_fatal_error',
    }, error instanceof Error ? error : new Error(errorMessage));
    throw error;
  }
}
