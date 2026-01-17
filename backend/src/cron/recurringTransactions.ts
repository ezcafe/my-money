/**
 * Cron Job for Recurring Transactions
 * Runs daily at midnight in production, or every minute in development mode
 * Includes retry logic, structured logging, and error tracking
 */


import cron from 'node-cron';
import {prisma} from '../utils/prisma';
import {retry, isRetryableError} from '../utils/retry';
import {logInfo, logError, logWarn} from '../utils/logger';
import {incrementAccountBalance} from '../services/AccountBalanceService';
import {updateBudgetForTransaction} from '../services/BudgetService';
import {RECURRING_TRANSACTION_CONCURRENCY_LIMIT} from '../utils/constants';
import {
  getLastRunDate,
  updateLastRunDate,
  calculateNextRunDate,
  getMissedRunsByInterval,
  getIntervalFromCron,
} from '../utils/cronJobUtils';

/**
 * Process a single recurring transaction with retry logic
 * @param recurring - Recurring transaction to process
 * @param currentTime - Current time (or target date for processing)
 * @param cronExpression - Cron expression for this recurring transaction
 * @returns true if successful, false if failed after retries
 */
async function processRecurringTransaction(
  recurring: {
    id: string;
    value: number;
    accountId: string;
    categoryId: string | null;
    payeeId: string | null;
    note: string | null;
    userId: string;
    nextRunDate: Date;
  },
  currentTime: Date,
  cronExpression: string,
): Promise<boolean> {
  const context = {
    recurringTransactionId: recurring.id,
    userId: recurring.userId,
    accountId: recurring.accountId,
    value: recurring.value,
  };

  try {
    // Fetch category if categoryId exists to determine balance delta
    let category: {categoryType: 'Income' | 'Expense'} | null = null;
    if (recurring.categoryId) {
      const foundCategory = await prisma.category.findUnique({
        where: {id: recurring.categoryId},
        select: {categoryType: true},
      });
      category = foundCategory;
    }

    // Calculate balance delta based on category type
    // Income categories add money, Expense categories (or no category) subtract money
    const balanceDelta = category?.categoryType === 'Income'
      ? recurring.value
      : -recurring.value;

    // Retry the operation with exponential backoff
    await retry(
      async () => {
        // Use database transaction to ensure atomicity
        // Transaction creation, balance update, and recurring transaction update must succeed together
        await prisma.$transaction(async (tx): Promise<void> => {
          // Create transaction
          const newTransaction = await tx.transaction.create({
            data: {
              value: recurring.value,
              date: new Date(),
              accountId: recurring.accountId,
              categoryId: recurring.categoryId,
              payeeId: recurring.payeeId,
              note: recurring.note,
              userId: recurring.userId,
            },
          });

          // Update account balance incrementally based on category type
          await incrementAccountBalance(recurring.accountId, balanceDelta, tx);

          // Update budgets for this transaction
          await updateBudgetForTransaction(
            {
              id: newTransaction.id,
              accountId: newTransaction.accountId,
              categoryId: newTransaction.categoryId,
              payeeId: newTransaction.payeeId,
              userId: newTransaction.userId,
              value: Number(newTransaction.value),
              date: newTransaction.date,
              categoryType: category?.categoryType ?? null,
            },
            'create',
            undefined,
            tx,
          );

          // Calculate next run date based on cron expression
          const nextRunDate = calculateNextRunDate(cronExpression, currentTime);

          // Update next run date
          await tx.recurringTransaction.update({
            where: {id: recurring.id},
            data: {nextRunDate},
          });
        });
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        retryableErrors: isRetryableError,
      },
    );

    const nextRunDate = calculateNextRunDate(cronExpression, currentTime);

    logInfo('Successfully processed recurring transaction', {
      ...context,
      nextRunDate: nextRunDate.toISOString(),
    });

    return true;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    // Log error with structured context
    logError(
      `Failed to process recurring transaction after retries: ${errorObj.message}`,
      {
        ...context,
        errorType: errorObj.name,
        retryable: isRetryableError(errorObj),
      },
      errorObj,
    );

    // Alert: Log critical failure that requires attention
    // In production, this could be sent to an alerting system
    if (!isRetryableError(errorObj)) {
      logWarn('Non-retryable error in recurring transaction - manual intervention may be required', {
        ...context,
        errorType: errorObj.name,
      });
    }

    return false;
  }
}

/**
 * Process recurring transactions that are due
 * @param targetDate - Optional target date to process for (defaults to now)
 * @returns Statistics about the processing run
 */
export async function processRecurringTransactions(targetDate?: Date): Promise<{
  total: number;
  successful: number;
  failed: number;
}> {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const now = targetDate ?? new Date();
  // In development (minutely), use current time; in production (daily), use start of day
  const cutoffTime = isDevelopment
    ? now
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  logInfo('Starting recurring transactions processing', {
    date: cutoffTime.toISOString(),
    mode: isDevelopment ? 'development (minutely)' : 'production (daily)',
  });

  // Find recurring transactions that are due
  // Check if we're processing a historical time (catch-up scenario)
  const isCatchUp = targetDate !== undefined && targetDate < new Date();

  let dueTransactions;

  if (isCatchUp) {
    // For catch-up, we need to process transactions based on their cron expression interval
    // Get all recurring transactions and filter by whether they should have run by the target time
    const allRecurring = await prisma.recurringTransaction.findMany();

    // Filter transactions that should have been processed by the target time
    // based on their cron expression interval
    dueTransactions = allRecurring.filter((rt) => {
      const interval = getIntervalFromCron(rt.cronExpression);
      if (!interval) {
        // Unknown interval, use nextRunDate check as fallback
        return rt.nextRunDate <= cutoffTime;
      }

      // For catch-up, check if the transaction should have run by the target time
      // by comparing the interval's expected run times
      const missedRuns = getMissedRunsByInterval(
        rt.cronExpression,
        rt.nextRunDate,
        cutoffTime,
        1, // Only need to check if there's at least one missed run
      );

      // If there are missed runs, this transaction should be processed
      return missedRuns.length > 0 || rt.nextRunDate <= cutoffTime;
    });
  } else {
    // Normal processing: find transactions where nextRunDate <= cutoffTime
    dueTransactions = await prisma.recurringTransaction.findMany({
      where: {
        nextRunDate: {
          lte: cutoffTime,
        },
      },
    });
  }

  logInfo(`Found ${dueTransactions.length} recurring transactions to process`, {
    count: dueTransactions.length,
  });

  let successful = 0;
  let failed = 0;

  // Process transactions in batches with concurrency limits to avoid memory issues
  for (let i = 0; i < dueTransactions.length; i += RECURRING_TRANSACTION_CONCURRENCY_LIMIT) {
    const batch = dueTransactions.slice(i, i + RECURRING_TRANSACTION_CONCURRENCY_LIMIT);

    const batchResults = await Promise.all(
      batch.map(async (recurring) => {
        const success = await processRecurringTransaction(
          {
            id: recurring.id,
            value: Number(recurring.value),
            accountId: recurring.accountId,
            categoryId: recurring.categoryId,
            payeeId: recurring.payeeId,
            note: recurring.note,
            userId: recurring.userId,
            nextRunDate: recurring.nextRunDate,
          },
          cutoffTime,
          recurring.cronExpression,
        );
        return success;
      }),
    );

    for (const success of batchResults) {
      if (success) {
        successful++;
      } else {
        failed++;
      }
    }
  }

  const stats = {
    total: dueTransactions.length,
    successful,
    failed,
  } as const;

  logInfo('Completed recurring transactions processing', stats);

  // Alert if there were failures
  if (failed > 0) {
    logWarn('Some recurring transactions failed to process', stats);
  }

  return stats;
}

/**
 * Start cron job to run daily at midnight (or minutely in development)
 * Includes error handling for the cron job itself and missed run catch-up
 */
export function startRecurringTransactionsCron(): void {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  // In development, run every minute; in production, run daily at midnight
  const cronSchedule = isDevelopment ? '* * * * *' : '0 0 * * *';
  const scheduleDescription = isDevelopment ? 'Every minute (development mode)' : 'Daily at midnight';

  cron.schedule(cronSchedule, async (): Promise<void> => {
    const jobName = 'recurringTransactions';
    try {
      logInfo('Cron job started: Processing recurring transactions');

      const now = new Date();
      // In development, use current time; in production, use start of day for missed run detection
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Check for missed runs (both development and production)
      const lastRunDate = await getLastRunDate(jobName);

      if (lastRunDate) {
        // Get all recurring transactions to check for missed runs
        const allRecurringTransactions = await prisma.recurringTransaction.findMany();

        // Collect all missed run dates across all transactions
        const allMissedRuns = new Map<string, Date[]>();
        let totalMissedRuns = 0;

        for (const transaction of allRecurringTransactions) {
          const interval = getIntervalFromCron(transaction.cronExpression);
          if (!interval) {
            // Unknown interval, skip catch-up for this transaction
            continue;
          }

          // Calculate missed runs for this transaction based on its interval
          // Use the transaction's nextRunDate as the starting point, or lastRunDate if earlier
          const startDate = transaction.nextRunDate < lastRunDate
            ? transaction.nextRunDate
            : lastRunDate;

          const cutoffTime = isDevelopment ? now : today;
          const missedRuns = getMissedRunsByInterval(
            transaction.cronExpression,
            startDate,
            cutoffTime,
            365, // Max missed runs per transaction
          );

          if (missedRuns.length > 0) {
            // Store missed runs by date for batch processing
            for (const missedDate of missedRuns) {
              const dateKey = missedDate.toISOString();
              if (!allMissedRuns.has(dateKey)) {
                allMissedRuns.set(dateKey, []);
              }
            }
            totalMissedRuns += missedRuns.length;
          }
        }

        if (totalMissedRuns > 0) {
          logWarn('Missed runs detected, processing catch-up', {
            jobName,
            lastRunDate: lastRunDate.toISOString(),
            currentDate: isDevelopment ? now.toISOString() : today.toISOString(),
            totalMissedRuns,
            uniqueDates: allMissedRuns.size,
          });

          // Process each unique missed run date sequentially
          const sortedMissedDates = Array.from(allMissedRuns.keys())
            .map((dateStr) => new Date(dateStr))
            .sort((a, b) => a.getTime() - b.getTime());

          for (const missedDate of sortedMissedDates) {
            try {
              logInfo('Processing missed run', {
                jobName,
                date: missedDate.toISOString(),
              });

              await processRecurringTransactions(missedDate);
            } catch (error) {
              const errorObj = error instanceof Error ? error : new Error(String(error));
              logError('Failed to process missed run', {
                jobName,
                date: missedDate.toISOString(),
              }, errorObj);
              // Continue with remaining missed runs even if one fails
            }
          }

          logInfo('Completed processing missed runs', {
            jobName,
            processedDates: sortedMissedDates.length,
            totalMissedRuns,
          });
        }
      }

      // Process current time (or current day in production)
      const stats = await processRecurringTransactions(now);

      // Update last run date after successful completion
      // In development, use current time with minute precision; in production, use start of day
      const lastRunDateToStore = isDevelopment ? now : today;
      await updateLastRunDate(jobName, lastRunDateToStore);

      logInfo('Cron job completed: Recurring transactions processed', stats);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError('Cron job failed with unexpected error', {
        jobName,
      }, errorObj);

      // In production, this could trigger alerts to monitoring systems
      // For now, we log the error and continue
    }
  });

  logInfo('Recurring transactions cron job scheduled', {
    schedule: cronSchedule,
    description: scheduleDescription,
  });
}


