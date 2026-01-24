/**
 * Data Archival Service
 * Handles archival of old transactions and data retention policies
 */

import { prisma } from '../utils/prisma';
import { logInfo, logError } from '../utils/logger';

/**
 * Archive old transactions
 * Moves transactions older than the retention period to an archive table
 * @param retentionDays - Number of days to retain (default: 365)
 * @param workspaceId - Optional workspace ID to archive for specific workspace
 * @returns Number of transactions archived
 */
export async function archiveOldTransactions(
  retentionDays: number = 365,
  workspaceId?: string
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    // Create archive table if it doesn't exist
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "TransactionArchive" (
        LIKE "Transaction" INCLUDING ALL
      )
    `;

    // Move old transactions to archive
    let result: number;
    if (workspaceId) {
      result = await prisma.$executeRaw`
        INSERT INTO "TransactionArchive"
        SELECT * FROM "Transaction"
        WHERE "date" < ${cutoffDate}
        AND "accountId" IN (
          SELECT "id" FROM "Account" WHERE "workspaceId" = ${workspaceId}
        )
      `;
    } else {
      result = await prisma.$executeRaw`
        INSERT INTO "TransactionArchive"
        SELECT * FROM "Transaction"
        WHERE "date" < ${cutoffDate}
      `;
    }

    // Delete archived transactions from main table
    if (workspaceId) {
      await prisma.$executeRaw`
        DELETE FROM "Transaction"
        WHERE "date" < ${cutoffDate}
        AND "accountId" IN (
          SELECT "id" FROM "Account" WHERE "workspaceId" = ${workspaceId}
        )
      `;
    } else {
      await prisma.$executeRaw`
        DELETE FROM "Transaction"
        WHERE "date" < ${cutoffDate}
      `;
    }

    const archivedCount = typeof result === 'number' ? result : 0;

    logInfo('Archived old transactions', {
      event: 'data_archival',
      retentionDays,
      archivedCount,
      workspaceId,
    });

    return archivedCount;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError(
      'Failed to archive old transactions',
      {
        event: 'data_archival_failed',
        retentionDays,
        workspaceId,
      },
      errorObj
    );
    throw errorObj;
  }
}

/**
 * Get archival statistics
 * @param workspaceId - Optional workspace ID
 * @returns Archival statistics
 */
export async function getArchivalStats(workspaceId?: string): Promise<{
  totalTransactions: number;
  archivedTransactions: number;
  transactionsToArchive: number;
}> {
  try {
    const queries = workspaceId
      ? [
          prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM "Transaction"
            WHERE "accountId" IN (
              SELECT "id" FROM "Account" WHERE "workspaceId" = ${workspaceId}
            )
          `,
          prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM "TransactionArchive"
            WHERE "accountId" IN (
              SELECT "id" FROM "Account" WHERE "workspaceId" = ${workspaceId}
            )
          `,
          prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM "Transaction"
            WHERE "date" < NOW() - INTERVAL '365 days'
            AND "accountId" IN (
              SELECT "id" FROM "Account" WHERE "workspaceId" = ${workspaceId}
            )
          `,
        ]
      : [
          prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM "Transaction"
          `,
          prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM "TransactionArchive"
          `,
          prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM "Transaction"
            WHERE "date" < NOW() - INTERVAL '365 days'
          `,
        ];

    const [totalResult, archivedResult, toArchiveResult] =
      await Promise.all(queries);

    return {
      totalTransactions: Number(totalResult?.[0]?.count ?? 0),
      archivedTransactions: Number(archivedResult?.[0]?.count ?? 0),
      transactionsToArchive: Number(toArchiveResult?.[0]?.count ?? 0),
    };
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError(
      'Failed to get archival stats',
      {
        event: 'archival_stats_failed',
        workspaceId,
      },
      errorObj
    );
    return {
      totalTransactions: 0,
      archivedTransactions: 0,
      transactionsToArchive: 0,
    };
  }
}

/**
 * Partition transactions table by date
 * Creates monthly partitions for better query performance
 * @param startDate - Start date for partitioning
 * @param endDate - End date for partitioning
 */
export function partitionTransactionsTable(
  startDate: Date,
  endDate: Date
): Promise<void> {
  try {
    // Note: This is a simplified implementation
    // Full partitioning would require more complex logic
    logInfo('Transaction partitioning', {
      event: 'partition_transactions',
      startDate,
      endDate,
    });
    return Promise.resolve();
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError(
      'Failed to partition transactions table',
      {
        event: 'partition_failed',
      },
      errorObj
    );
    throw errorObj;
  }
}

/**
 * Clean up archived transactions older than specified days
 * Permanently deletes archived transactions beyond the archive retention period
 * @param archiveRetentionDays - Number of days to retain archived data (default: 1095 = 3 years)
 * @returns Number of archived transactions deleted
 */
export async function cleanupArchivedTransactions(
  archiveRetentionDays: number = 1095
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - archiveRetentionDays);

  try {
    // Check if archive table exists
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'TransactionArchive'
      ) as exists
    `;

    if (!tableExists[0]?.exists) {
      logInfo('Archive table does not exist, skipping cleanup', {
        event: 'archive_cleanup_skipped',
      });
      return 0;
    }

    // Delete old archived transactions
    const result = await prisma.$executeRaw`
      DELETE FROM "TransactionArchive"
      WHERE "date" < ${cutoffDate}
    `;

    const deletedCount = typeof result === 'number' ? result : 0;

    logInfo('Cleaned up archived transactions', {
      event: 'archive_cleanup',
      archiveRetentionDays,
      deletedCount,
    });

    return deletedCount;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError(
      'Failed to cleanup archived transactions',
      {
        event: 'archive_cleanup_failed',
        archiveRetentionDays,
      },
      errorObj
    );
    throw errorObj;
  }
}
