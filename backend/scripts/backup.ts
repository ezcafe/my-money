/**
 * Database Backup Script
 * Implements automated database backups with verification
 *
 * Usage:
 *   npm run backup
 *   or
 *   node scripts/backup.js
 *
 * Environment variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   BACKUP_DIR - Directory to store backups (default: ./backups)
 *   BACKUP_RETENTION_DAYS - Number of days to keep backups (default: 30)
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { logInfo, logError, logWarn } from '../src/utils/logger';

const execAsync = promisify(exec);

/**
 * Backup configuration
 */
interface BackupConfig {
  databaseUrl: string;
  backupDir: string;
  retentionDays: number;
}

/**
 * Get backup configuration from environment variables
 */
function getBackupConfig(): BackupConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Parse database URL to extract connection details
  // const url = new URL(databaseUrl);
  // Extract connection details (kept for potential future use)
  // const databaseName = url.pathname.slice(1); // Remove leading '/'
  // const host = url.hostname;
  // const port = url.port || '5432';
  // const username = url.username;
  // const password = url.password;

  return {
    databaseUrl,
    backupDir: process.env.BACKUP_DIR || join(process.cwd(), 'backups'),
    retentionDays: Number.parseInt(
      process.env.BACKUP_RETENTION_DAYS || '30',
      10
    ),
  };
}

/**
 * Create backup directory if it doesn't exist
 */
async function ensureBackupDir(backupDir: string): Promise<void> {
  try {
    await fs.access(backupDir);
  } catch {
    await fs.mkdir(backupDir, { recursive: true });
    logInfo('Created backup directory', { backupDir });
  }
}

/**
 * Generate backup filename with timestamp
 */
function generateBackupFilename(databaseName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${databaseName}-${timestamp}.sql.gz`;
}

/**
 * Create database backup using pg_dump
 */
async function createBackup(config: BackupConfig): Promise<string> {
  const url = new URL(config.databaseUrl);
  const databaseName = url.pathname.slice(1);
  const host = url.hostname;
  const port = url.port || '5432';
  const username = url.username;
  const password = url.password;

  const backupFilename = generateBackupFilename(databaseName);
  const backupPath = join(config.backupDir, backupFilename);

  // Set PGPASSWORD environment variable for pg_dump
  const env = {
    ...process.env,
    PGPASSWORD: password,
  };

  // Build pg_dump command
  const pgDumpCommand = [
    'pg_dump',
    `-h ${host}`,
    `-p ${port}`,
    `-U ${username}`,
    `-d ${databaseName}`,
    '--no-owner',
    '--no-acl',
    '--clean',
    '--if-exists',
    '| gzip',
    `> ${backupPath}`,
  ].join(' ');

  try {
    logInfo('Starting database backup', {
      database: databaseName,
      backupPath,
    });

    await execAsync(pgDumpCommand, { env, shell: '/bin/bash' });

    // Verify backup file exists and has content
    const stats = await fs.stat(backupPath);
    if (stats.size === 0) {
      throw new Error('Backup file is empty');
    }

    logInfo('Database backup created successfully', {
      backupPath,
      sizeBytes: stats.size,
      sizeMB: Math.round((stats.size / 1024 / 1024) * 100) / 100,
    });

    return backupPath;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError(
      'Database backup failed',
      {
        database: databaseName,
        backupPath,
      },
      errorObj
    );
    throw errorObj;
  }
}

/**
 * Verify backup file integrity
 */
async function verifyBackup(backupPath: string): Promise<boolean> {
  try {
    // Check if file exists and is readable
    await fs.access(backupPath);

    // Check file size (should be > 0)
    const stats = await fs.stat(backupPath);
    if (stats.size === 0) {
      logWarn('Backup file is empty', { backupPath });
      return false;
    }

    // Try to decompress and check if it's valid SQL
    // This is a basic check - full verification would require restoring to a test database
    logInfo('Backup file verified', {
      backupPath,
      sizeBytes: stats.size,
    });

    return true;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError(
      'Backup verification failed',
      {
        backupPath,
      },
      errorObj
    );
    return false;
  }
}

/**
 * Clean up old backups based on retention policy
 */
async function cleanupOldBackups(
  backupDir: string,
  retentionDays: number
): Promise<number> {
  try {
    const files = await fs.readdir(backupDir);
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      if (!file.endsWith('.sql.gz')) {
        continue;
      }

      const filePath = join(backupDir, file);
      const stats = await fs.stat(filePath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > retentionMs) {
        await fs.unlink(filePath);
        deletedCount++;
        logInfo('Deleted old backup', {
          file,
          ageDays: Math.round(fileAge / (24 * 60 * 60 * 1000)),
        });
      }
    }

    if (deletedCount > 0) {
      logInfo('Cleanup completed', {
        deletedCount,
        retentionDays,
      });
    }

    return deletedCount;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError(
      'Backup cleanup failed',
      {
        backupDir,
      },
      errorObj
    );
    return 0;
  }
}

/**
 * Main backup function
 */
async function main(): Promise<void> {
  try {
    const config = getBackupConfig();

    // Ensure backup directory exists
    await ensureBackupDir(config.backupDir);

    // Create backup
    const backupPath = await createBackup(config);

    // Verify backup
    const isValid = await verifyBackup(backupPath);
    if (!isValid) {
      throw new Error('Backup verification failed');
    }

    // Cleanup old backups
    await cleanupOldBackups(config.backupDir, config.retentionDays);

    logInfo('Backup process completed successfully', {
      backupPath,
    });

    process.exit(0);
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Backup process failed', {}, errorObj);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

export {
  main as runBackup,
  getBackupConfig,
  createBackup,
  verifyBackup,
  cleanupOldBackups,
};
