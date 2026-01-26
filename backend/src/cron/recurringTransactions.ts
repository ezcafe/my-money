/**
 * Cron Job for Recurring Transactions
 * Runs daily at midnight by default, or every minute when hourly/minutely schedules are enabled
 * Includes retry logic, structured logging, and error tracking
 */

import cron from 'node-cron';
import { prisma } from '../utils/prisma';
import { retry, isRetryableError } from '../utils/retry';
import { logInfo, logError, logWarn } from '../utils/logger';
import { incrementAccountBalance } from '../services/AccountBalanceService';
import { updateBudgetForTransaction } from '../services/BudgetService';
import { RECURRING_TRANSACTION_CONCURRENCY_LIMIT } from '../utils/constants';
import {
  getLastRunDate,
  updateLastRunDate,
  calculateNextRunDate,
  getMissedRunsByInterval,
  getIntervalFromCron,
} from '../utils/cronJobUtils';
import { transactionEventEmitter } from '../events';

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
    nextRunDate: Date;
  },
  currentTime: Date,
  cronExpression: string
): Promise<boolean> {
  const context = {
    recurringTransactionId: recurring.id,
    accountId: recurring.accountId,
    value: recurring.value,
  };

  try {
    // Fetch category if categoryId exists to determine balance delta
    let category: { categoryType: 'Income' | 'Expense' } | null = null;
    if (recurring.categoryId) {
      const foundCategory = await prisma.category.findUnique({
        where: { id: recurring.categoryId },
        select: { categoryType: true },
      });
      category = foundCategory;
    }

    // Calculate balance delta based on category type
    // Income categories add money, Expense categories (or no category) subtract money
    const balanceDelta =
      category?.categoryType === 'Income' ? recurring.value : -recurring.value;

    // Calculate next run date based on cron expression
    const nextRunDate = calculateNextRunDate(cronExpression, currentTime);

    // Retry the operation with exponential backoff
    await retry(
      async () => {
        // Use database transaction to ensure atomicity
        // Transaction creation, balance update, and recurring transaction update must succeed together
        await prisma.$transaction(async (tx): Promise<void> => {
          // Get account to retrieve workspaceId and userId (from createdBy)
          const account = await tx.account.findUnique({
            where: { id: recurring.accountId },
            select: { workspaceId: true, createdBy: true },
          });

          if (!account) {
            throw new Error(`Account ${recurring.accountId} not found`);
          }

          // Use account's createdBy as userId (the user who owns the account)
          const userId = account.createdBy;

          // Create transaction
          const newTransaction = await tx.transaction.create({
            data: {
              value: recurring.value,
              date: new Date(),
              accountId: recurring.accountId,
              categoryId: recurring.categoryId,
              payeeId: recurring.payeeId,
              note: recurring.note,
              createdBy: userId,
              lastEditedBy: userId,
            },
            include: {
              account: true,
              category: true,
              payee: true,
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
              userId,
              workspaceId: account.workspaceId,
              value: Number(newTransaction.value),
              date: newTransaction.date,
              categoryType: category?.categoryType ?? null,
            },
            'create',
            undefined,
            tx
          );

          // Calculate next run date based on cron expression
          // const nextRunDate = calculateNextRunDate(cronExpression, currentTime);

          // Update next run date
          await tx.recurringTransaction.update({
            where: { id: recurring.id },
            data: { nextRunDate },
          });

          // Emit event after transaction is created
          transactionEventEmitter.emit('transaction.created', newTransaction);
        });
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        retryableErrors: isRetryableError,
      }
    );

    const nextRunDateFinal = calculateNextRunDate(cronExpression, currentTime);

    logInfo('Recurring transactions - successfully processed transaction', {
      ...context,
      nextRunDate: nextRunDateFinal.toISOString(),
    });

    return true;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    // Log error with structured context
    logError(
      `Recurring transactions - failed to process transaction after retries: ${errorObj.message}`,
      {
        ...context,
        errorType: errorObj.name,
        retryable: isRetryableError(errorObj),
      },
      errorObj
    );

    // Alert: Log critical failure that requires attention
    // In production, this could be sent to an alerting system
    if (!isRetryableError(errorObj)) {
      logWarn(
        'Recurring transactions - non-retryable error, manual intervention may be required',
        {
          ...context,
          errorType: errorObj.name,
        }
      );
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
  const enableHourlyMinutely =
    process.env.ENABLE_HOURLY_MINUTELY_SCHEDULES === 'true';
  const now = targetDate ?? new Date();
  // When hourly/minutely schedules are enabled, use current time; otherwise use start of day
  const cutoffTime = enableHourlyMinutely
    ? now
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
        1 // Only need to check if there's at least one missed run
      );

      // If there are missed runs, this transaction should be processed
      // Also check if the nextRunDate is in the past (historical missed run that wasn't updated)
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

  logInfo(
    `Recurring transactions - found ${dueTransactions.length} to process`,
    {
      count: dueTransactions.length,
    }
  );

  let successful = 0;
  let failed = 0;

  // Process transactions in batches with concurrency limits to avoid memory issues
  for (
    let i = 0;
    i < dueTransactions.length;
    i += RECURRING_TRANSACTION_CONCURRENCY_LIMIT
  ) {
    const batch = dueTransactions.slice(
      i,
      i + RECURRING_TRANSACTION_CONCURRENCY_LIMIT
    );

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
            nextRunDate: recurring.nextRunDate,
          },
          cutoffTime,
          recurring.cronExpression
        );
        return success;
      })
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

  // Alert if there were failures
  if (failed > 0) {
    logWarn('Recurring transactions - some failed to process', stats);
  }

  return stats;
}

/**
 * Start cron job to run daily at midnight (or minutely when hourly/minutely schedules enabled)
 * Includes error handling for the cron job itself and missed run catch-up
 */
export function startRecurringTransactionsCron(): void {
  const enableHourlyMinutely =
    process.env.ENABLE_HOURLY_MINUTELY_SCHEDULES === 'true';
  // When hourly/minutely schedules are enabled, run every minute; otherwise run daily at midnight
  const cronSchedule = enableHourlyMinutely ? '* * * * *' : '0 0 * * *';
  const scheduleDescription = enableHourlyMinutely
    ? 'Every minute (hourly/minutely schedules enabled)'
    : 'Daily at midnight';

  cron.schedule(cronSchedule, async (): Promise<void> => {
    const jobName = 'recurringTransactions';
    try {
      logInfo('Recurring transactions - started');

      const now = new Date();
      // When hourly/minutely schedules are enabled, use current time; otherwise use start of day for missed run detection
      const enableHourlyMinutely =
        process.env.ENABLE_HOURLY_MINUTELY_SCHEDULES === 'true';
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Check for missed runs (both development and production)
      const lastRunDate = await getLastRunDate(jobName);

      if (lastRunDate) {
        // Get all recurring transactions to check for missed runs
        const allRecurringTransactions =
          await prisma.recurringTransaction.findMany();

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
          const startDate =
            transaction.nextRunDate < lastRunDate
              ? transaction.nextRunDate
              : lastRunDate;

          const cutoffTime = enableHourlyMinutely ? now : today;
          const missedRuns = getMissedRunsByInterval(
            transaction.cronExpression,
            startDate,
            cutoffTime,
            365 // Max missed runs per transaction
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
          logWarn(
            'Recurring transactions - missed runs detected, processing catch-up',
            {
              jobName,
              lastRunDate: lastRunDate.toISOString(),
              currentDate: enableHourlyMinutely
                ? now.toISOString()
                : today.toISOString(),
              totalMissedRuns,
              uniqueDates: allMissedRuns.size,
            }
          );

          // Process each unique missed run date sequentially
          const sortedMissedDates = Array.from(allMissedRuns.keys())
            .map((dateStr) => new Date(dateStr))
            .sort((a, b) => a.getTime() - b.getTime());

          for (const missedDate of sortedMissedDates) {
            try {
              logInfo('Recurring transactions - processing missed run', {
                jobName,
                date: missedDate.toISOString(),
              });

              await processRecurringTransactions(missedDate);
            } catch (error) {
              const errorObj =
                error instanceof Error ? error : new Error(String(error));
              logError(
                'Recurring transactions - failed to process missed run',
                {
                  jobName,
                  date: missedDate.toISOString(),
                },
                errorObj
              );
              // Continue with remaining missed runs even if one fails
            }
          }

          logInfo('Recurring transactions - completed processing missed runs', {
            jobName,
            processedDates: sortedMissedDates.length,
            totalMissedRuns,
          });
        }
      }

      // Process current time (or current day in production)
      const stats = await processRecurringTransactions(now);

      // Update last run date after successful completion
      // When hourly/minutely schedules are enabled, use current time with minute precision; otherwise use start of day
      const lastRunDateToStore = enableHourlyMinutely ? now : today;
      await updateLastRunDate(jobName, lastRunDateToStore);

      logInfo('Recurring transactions - completed', stats);
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      logError(
        'Recurring transactions - failed',
        {
          jobName,
        },
        errorObj
      );

      // In production, this could trigger alerts to monitoring systems
      // For now, we log the error and continue
    }
  });

  logInfo('Recurring transactions - scheduled', {
    schedule: cronSchedule,
    description: scheduleDescription,
  });
}
