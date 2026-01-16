/**
 * Programmatic Database Schema Sync Runner
 * Syncs Prisma schema to database on application startup using Prisma's db push
 * This replaces migrations since all schema changes have been merged into the main schema
 */

import {execSync} from 'child_process';
import {join} from 'path';
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import {logError} from './logger';

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
    // Import Prisma client dynamically to check connectivity
    const {prisma} = await import('./prisma');
    await prisma.$queryRaw`SELECT 1`;
    return true;
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
  // eslint-disable-next-line no-console
  console.log('Waiting for database to be ready...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // eslint-disable-next-line no-console
    console.log(`Attempt ${attempt}/${maxRetries}: Checking database connection...`);

    if (await checkDatabaseAccessibility()) {
      // eslint-disable-next-line no-console
      console.log('Database is ready!');
      return;
    }

    if (attempt < maxRetries) {
      // eslint-disable-next-line no-console
      console.log(`Database not ready yet. Waiting ${retryDelayMs / 1000}s before retry...`);
      await sleep(retryDelayMs);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    'WARNING: Could not verify database connectivity, but proceeding with migration attempt...',
  );
  // eslint-disable-next-line no-console
  console.log('This is normal if database is starting up. Migration will retry on failure.');
}

/**
 * Sync Prisma schema to database using db push
 * Uses Prisma CLI via Node.js directly
 * This syncs the schema directly without requiring migrations
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelayMs - Delay between retries in milliseconds
 * @param timeoutMs - Timeout for sync operation in milliseconds
 */
export async function runMigrations(
  maxRetries: number = MAX_RETRIES,
  retryDelayMs: number = RETRY_DELAY,
  timeoutMs: number = MIGRATION_TIMEOUT,
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Syncing database schema...');
  // eslint-disable-next-line no-console
  console.log(`DATABASE_URL is set: ${process.env.DATABASE_URL ? 'yes' : 'no'}`);

  const backendPath = join(__dirname, '../..');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // eslint-disable-next-line no-console
    console.log(`Schema sync attempt ${attempt}/${maxRetries}...`);

    try {
      // Use Prisma db push to sync schema directly
      // This applies the schema without requiring migrations
      // Use npx to find the correct Prisma binary
      execSync('npx prisma db push', {
        cwd: backendPath,
        stdio: 'inherit', // Show sync output
        timeout: timeoutMs,
        env: {
          ...process.env,
          // Ensure Prisma uses the correct schema path
          PRISMA_SCHEMA_PATH: join(backendPath, 'prisma/schema.prisma'),
        },
      });

      // eslint-disable-next-line no-console
      console.log('Schema sync completed successfully');
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const exitCode = (error && typeof error === 'object' && 'status' in error ? (error.status as number | string) : 1);
      const exitCodeNumber = typeof exitCode === 'string' ? Number.parseInt(exitCode, 10) : exitCode;

      // eslint-disable-next-line no-console
      console.log(`Schema sync attempt ${attempt} failed (exit code: ${exitCodeNumber})`);
      // eslint-disable-next-line no-console
      console.log(`Error: ${errorMessage}`);

      if (attempt < maxRetries) {
        // eslint-disable-next-line no-console
        console.log(`Waiting ${retryDelayMs / 1000}s before retry...`);
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
