/**
 * Cron Job for Budget Reset
 * Runs monthly on the first day to reset budget spending
 */

import cron from 'node-cron';
import {prisma} from '../utils/prisma';
import {logInfo, logError, logWarn} from '../utils/logger';
import {getCurrentMonthStart} from '../services/BudgetService';
import {BUDGET_BATCH_SIZE, BUDGET_CONCURRENCY_LIMIT} from '../utils/constants';

/**
 * Process budget resets for all users
 * Resets currentSpent to 0 and updates lastResetDate for budgets that haven't been reset this month
 * @returns Statistics about the reset run
 */
export async function processBudgetResets(): Promise<{
  total: number;
  reset: number;
}> {
  const monthStart = getCurrentMonthStart();

  logInfo('Starting budget reset processing', {
    monthStart: monthStart.toISOString(),
  });

  // Find all budgets that haven't been reset this month
  const budgetsToReset = await prisma.budget.findMany({
    where: {
      lastResetDate: {
        lt: monthStart,
      },
    },
  });

  logInfo(`Found ${budgetsToReset.length} budgets to reset`, {
    count: budgetsToReset.length,
  });

  let reset = 0;

  // Process budgets in batches to avoid loading all into memory at once
  for (let i = 0; i < budgetsToReset.length; i += BUDGET_BATCH_SIZE) {
    const batch = budgetsToReset.slice(i, i + BUDGET_BATCH_SIZE);

    // Process batch in parallel with concurrency limit
    const batchPromises: Array<Promise<void>> = [];

      for (let j = 0; j < batch.length; j += BUDGET_CONCURRENCY_LIMIT) {
        const concurrentBatch = batch.slice(j, j + BUDGET_CONCURRENCY_LIMIT);
      const promises = concurrentBatch.map(async (budget) => {
        try {
          await prisma.budget.update({
            where: {id: budget.id},
            data: {
              currentSpent: 0,
              lastResetDate: monthStart,
            },
          });
          reset++;
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          logError('Failed to reset budget', {
            budgetId: budget.id,
            userId: budget.userId,
          }, errorObj);
        }
      });
      batchPromises.push(...promises);
      // Wait for this concurrent batch to complete before starting next
      await Promise.all(promises);
    }
  }

  const stats = {
    total: budgetsToReset.length,
    reset,
  } as const;

  logInfo('Completed budget reset processing', stats);

  if (reset < budgetsToReset.length) {
    logWarn('Some budgets failed to reset', stats);
  }

  return stats;
}

/**
 * Start cron job to run monthly on the first day at midnight
 * Includes error handling for the cron job itself
 */
export function startBudgetResetCron(): void {
  // Run monthly on the first day at 00:00 (server timezone)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  cron.schedule('0 0 1 * *', async (): Promise<void> => {
    try {
      logInfo('Cron job started: Processing budget resets');
      const stats = await processBudgetResets();
      logInfo('Cron job completed: Budget resets processed', stats);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError('Cron job failed with unexpected error', {
        jobName: 'budgetReset',
      }, errorObj);

      // In production, this could trigger alerts to monitoring systems
      // For now, we log the error and continue
    }
  });

  logInfo('Budget reset cron job scheduled', {
    schedule: '0 0 1 * *',
    description: 'Monthly on the first day at midnight',
  });
}

