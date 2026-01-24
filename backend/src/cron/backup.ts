/**
 * Database Backup Cron Job
 * Periodically creates database backups with verification
 * Runs daily at 2 AM
 */

import cron from 'node-cron';
import { runBackup } from '../../scripts/backup';
import { logInfo, logError } from '../utils/logger';

/**
 * Start cron job to run database backup daily
 * Runs at 2 AM every day
 */
export function startBackupCron(): void {
  // Run daily at 2 AM
  cron.schedule('0 2 * * *', async (): Promise<void> => {
    try {
      logInfo('Database backup - started');
      await runBackup();
      logInfo('Database backup - completed');
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      logError(
        'Database backup - failed',
        {
          jobName: 'databaseBackup',
        },
        errorObj
      );
    }
  });

  logInfo('Database backup - scheduled', {
    schedule: '0 2 * * *',
    description: 'Daily at 2 AM',
  });
}
