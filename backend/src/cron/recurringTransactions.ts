/**
 * Cron Job for Recurring Transactions
 * Runs daily to process recurring transactions
 * Includes retry logic, structured logging, and error tracking
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import cron from 'node-cron';
import {prisma} from '../utils/prisma';
import {retry, isRetryableError} from '../utils/retry';
import {logInfo, logError, logWarn} from '../utils/logger';
import {incrementAccountBalance} from '../services/AccountBalanceService';
import {updateBudgetForTransaction} from '../services/BudgetService';

/**
 * Process a single recurring transaction with retry logic
 * @param recurring - Recurring transaction to process
 * @param today - Today's date
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
  today: Date,
): Promise<boolean> {
  const context = {
    recurringTransactionId: recurring.id,
    userId: recurring.userId,
    accountId: recurring.accountId,
    value: recurring.value,
  };

  try {
    // Fetch category if categoryId exists to determine balance delta
    let category: {type: 'INCOME' | 'EXPENSE'} | null = null;
    if (recurring.categoryId) {
      const foundCategory = await prisma.category.findUnique({
        where: {id: recurring.categoryId},
        select: {type: true},
      });
      category = foundCategory;
    }

    // Calculate balance delta based on category type
    // Income categories add money, Expense categories (or no category) subtract money
    const balanceDelta = category?.type === 'INCOME'
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
              value: newTransaction.value,
              date: newTransaction.date,
              categoryType: category?.type ?? null,
            },
            'create',
            undefined,
            tx,
          );

          // Calculate next run date based on cron expression
          // For simplicity, assuming daily for now
          const nextRunDate = new Date(today);
          nextRunDate.setDate(nextRunDate.getDate() + 1);

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

    logInfo('Successfully processed recurring transaction', {
      ...context,
      nextRunDate: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
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
 * @returns Statistics about the processing run
 */
export async function processRecurringTransactions(): Promise<{
  total: number;
  successful: number;
  failed: number;
}> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  logInfo('Starting recurring transactions processing', {
    date: today.toISOString(),
  });

  // Find recurring transactions that are due today or earlier
  const dueTransactions = await prisma.recurringTransaction.findMany({
    where: {
      nextRunDate: {
        lte: today,
      },
    },
  });

  logInfo(`Found ${dueTransactions.length} recurring transactions to process`, {
    count: dueTransactions.length,
  });

  let successful = 0;
  let failed = 0;

  // Process each transaction with retry logic
  for (const recurring of dueTransactions) {
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
      today,
    );

    if (success) {
      successful++;
    } else {
      failed++;
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
 * Start cron job to run daily at midnight
 * Includes error handling for the cron job itself
 */
export function startRecurringTransactionsCron(): void {
  // Run daily at 00:00
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  cron.schedule('0 0 * * *', async (): Promise<void> => {
    try {
      logInfo('Cron job started: Processing recurring transactions');
      const stats = await processRecurringTransactions();
      logInfo('Cron job completed: Recurring transactions processed', stats);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError('Cron job failed with unexpected error', {
        jobName: 'recurringTransactions',
      }, errorObj);

      // In production, this could trigger alerts to monitoring systems
      // For now, we log the error and continue
    }
  });

  logInfo('Recurring transactions cron job scheduled', {
    schedule: '0 0 * * *',
    description: 'Daily at midnight',
  });
}


