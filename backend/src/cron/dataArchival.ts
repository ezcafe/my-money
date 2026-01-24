/**
 * Data Archival Cron Job
 * Automatically archives old transactions based on retention policy
 * Runs daily to keep the database size manageable
 */

import {
  archiveOldTransactions,
  getArchivalStats,
  cleanupArchivedTransactions,
} from '../services/DataArchivalService';
import { logInfo, logError, logWarn } from '../utils/logger';
import { prisma } from '../utils/prisma';
import cron from 'node-cron';

/**
 * Default retention period in days (1 year)
 */
const DEFAULT_RETENTION_DAYS = 365;

/**
 * Run data archival for all workspaces
 * Archives transactions older than the retention period
 */
export async function runDataArchival(): Promise<void> {
  try {
    logInfo('Starting data archival cron job', {
      event: 'data_archival_cron_start',
    });

    // Get all workspaces
    const workspaces = await prisma.workspace.findMany({
      select: { id: true },
    });

    let totalArchived = 0;

    // Archive transactions for each workspace
    for (const workspace of workspaces) {
      try {
        const archivedCount = await archiveOldTransactions(
          DEFAULT_RETENTION_DAYS,
          workspace.id
        );
        totalArchived += archivedCount;

        logInfo('Archived transactions for workspace', {
          event: 'data_archival_workspace',
          workspaceId: workspace.id,
          archivedCount,
        });
      } catch (error) {
        logError(
          'Failed to archive transactions for workspace',
          {
            event: 'data_archival_workspace_failed',
            workspaceId: workspace.id,
          },
          error instanceof Error ? error : new Error(String(error))
        );
        // Continue with other workspaces even if one fails
      }
    }

    // Also archive transactions without workspace (legacy data)
    try {
      const archivedCount = await archiveOldTransactions(
        DEFAULT_RETENTION_DAYS
      );
      totalArchived += archivedCount;
    } catch {
      logWarn('Failed to archive legacy transactions', {
        event: 'data_archival_legacy_failed',
      });
    }

    // Clean up old archived transactions (beyond 3 years)
    let cleanedCount = 0;
    try {
      cleanedCount = await cleanupArchivedTransactions(1095); // 3 years
    } catch {
      logWarn('Failed to cleanup archived transactions', {
        event: 'archive_cleanup_failed',
      });
    }

    // Get archival statistics
    const stats = await getArchivalStats();

    logInfo('Data archival cron job completed', {
      event: 'data_archival_cron_complete',
      totalArchived,
      cleanedCount,
      stats: JSON.stringify(stats),
    });
  } catch (error) {
    logError(
      'Data archival cron job failed',
      {
        event: 'data_archival_cron_failed',
      },
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Start data archival cron job
 * Runs daily at 2 AM in production, or every hour in development
 */
export function startDataArchivalCron(): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Run daily at 2 AM in production, every hour in development
  const cronExpression = isProduction ? '0 2 * * *' : '0 * * * *';

  cron.schedule(cronExpression, async () => {
    try {
      await runDataArchival();
    } catch (error) {
      logError(
        'Data archival cron job failed',
        {
          event: 'data_archival_cron_error',
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

  logInfo('Data archival cron job scheduled', {
    event: 'data_archival_cron_scheduled',
    cronExpression,
    isProduction,
  });
}
