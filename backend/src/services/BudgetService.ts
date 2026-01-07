/**
 * Budget Service
 * Handles budget updates and threshold checks
 * Tracks spending against budgets for accounts, categories, or payees
 */

 
import type {PrismaClient} from '@prisma/client';
import {prisma} from '../utils/prisma';
import {createBudgetNotification} from './NotificationService';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Get start of current month in server timezone
 * @returns Date representing start of current month (00:00:00)
 */
export function getCurrentMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Check if a date is in the current month
 * @param date - Date to check
 * @returns true if date is in current month
 */
export function isCurrentMonth(date: Date): boolean {
  const now = new Date();
  const monthStart = getCurrentMonthStart();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return date >= monthStart && date <= monthEnd;
}

/**
 * Calculate spending change for a transaction
 * Only counts EXPENSE transactions from current month
 * @param transaction - Transaction data
 * @param categoryType - Category type (INCOME or EXPENSE)
 * @returns Spending change (positive for expenses, 0 for income or non-current-month)
 */
function calculateSpendingChange(
  transaction: {value: number | string; date: Date; categoryId: string | null},
  categoryType: 'INCOME' | 'EXPENSE' | null,
): number {
  // Only count EXPENSE transactions
  if (categoryType !== 'EXPENSE') {
    return 0;
  }

  // Only count transactions from current month
  if (!isCurrentMonth(transaction.date)) {
    return 0;
  }

  const value = typeof transaction.value === 'string' ? parseFloat(transaction.value) : transaction.value;
  return Math.abs(value); // Always positive for expenses
}

/**
 * Find budgets affected by a transaction
 * @param transaction - Transaction data
 * @param tx - Prisma transaction client
 * @returns Array of affected budgets
 */
async function findAffectedBudgets(
  transaction: {accountId: string; categoryId: string | null; payeeId: string | null; userId: string},
  tx: PrismaTransaction | PrismaClient,
): Promise<Array<{id: string; amount: number; currentSpent: number}>> {
  const budgets = await tx.budget.findMany({
    where: {
      userId: transaction.userId,
      OR: [
        {accountId: transaction.accountId},
        {categoryId: transaction.categoryId},
        {payeeId: transaction.payeeId},
      ],
    },
    select: {
      id: true,
      amount: true,
      currentSpent: true,
    },
  });

  return budgets.map((b) => ({
    id: b.id,
    amount: Number(b.amount),
    currentSpent: Number(b.currentSpent),
  }));
}

/**
 * Check budget thresholds and create notifications if needed
 * Only creates notification for the highest threshold reached
 * @param budget - Budget data
 * @param userId - User ID
 * @param tx - Prisma transaction client
 */
async function checkBudgetThresholds(
  budget: {id: string; amount: number; currentSpent: number},
  userId: string,
  tx: PrismaTransaction | PrismaClient,
): Promise<void> {
  const percentage = (budget.currentSpent / budget.amount) * 100;

  // Check thresholds: 50%, 80%, 100% (in descending order to find highest reached)
  const thresholds = [100, 80, 50];

  // Find the highest threshold that has been reached
  let highestThresholdReached: number | null = null;
  for (const threshold of thresholds) {
    if (percentage >= threshold) {
      highestThresholdReached = threshold;
      break;
    }
  }

  // Only create notification for the highest threshold reached
  if (highestThresholdReached !== null) {
    // Check if we've already notified for this threshold this month
    const monthStart = getCurrentMonthStart();
    const existingNotification = await tx.budgetNotification.findFirst({
      where: {
        userId,
        budgetId: budget.id,
        threshold: highestThresholdReached,
        createdAt: {
          gte: monthStart,
        },
      },
    });

    if (!existingNotification) {
      // Create notification only for the highest threshold
      await createBudgetNotification(userId, budget.id, highestThresholdReached, tx);
    }
  }
}

/**
 * Recalculate budget balance from scratch for current period
 * Sums all EXPENSE transactions in the current month that match the budget criteria
 * @param budgetId - Budget ID
 * @param userId - User ID
 * @param tx - Optional Prisma transaction client
 * @returns Recalculated currentSpent amount
 */
export async function recalculateBudgetBalance(
  budgetId: string,
  userId: string,
  tx?: PrismaTransaction | PrismaClient,
): Promise<number> {
  const client = tx ?? prisma;

  // Get budget with its criteria
  const budget = await client.budget.findFirst({
    where: {
      id: budgetId,
      userId,
    },
    select: {
      accountId: true,
      categoryId: true,
      payeeId: true,
    },
  });

  if (!budget) {
    throw new Error(`Budget ${budgetId} not found`);
  }

  // Build query to find matching transactions
  const monthStart = getCurrentMonthStart();
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  // Build OR conditions based on budget type
  const orConditions: Array<{
    accountId?: string;
    categoryId?: string;
    payeeId?: string;
  }> = [];

  if (budget.accountId) {
    orConditions.push({accountId: budget.accountId});
  }
  if (budget.categoryId) {
    orConditions.push({categoryId: budget.categoryId});
  }
  if (budget.payeeId) {
    orConditions.push({payeeId: budget.payeeId});
  }

  // Get all matching transactions with their categories
  // Filter by: userId, date range, category type EXPENSE, and budget criteria
  const transactions = await client.transaction.findMany({
    where: {
      userId,
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
      category: {
        type: 'EXPENSE',
      },
      ...(orConditions.length > 0 && {OR: orConditions}),
    },
    include: {
      category: {
        select: {type: true},
      },
    },
  });

  // Calculate total spending (only EXPENSE transactions in current month)
  let totalSpent = 0;
  for (const transaction of transactions) {
    // Double-check category type (should already be filtered, but be safe)
    if (transaction.category?.type === 'EXPENSE' && isCurrentMonth(transaction.date)) {
      const value = Number(transaction.value);
      totalSpent += Math.abs(value);
    }
  }

  // Update budget with recalculated amount
  await client.budget.update({
    where: {id: budgetId},
    data: {currentSpent: totalSpent},
  });

  // Check thresholds with updated budget
  const budgetAmount = await client.budget.findUnique({
    where: {id: budgetId},
    select: {amount: true},
  });

  if (budgetAmount) {
    const updatedBudget = {
      id: budgetId,
      amount: Number(budgetAmount.amount),
      currentSpent: totalSpent,
    };
    await checkBudgetThresholds(updatedBudget, userId, client);
  }

  return totalSpent;
}

/**
 * Update budgets for a transaction
 * @param transaction - Transaction data with category type
 * @param operation - Operation type (create, update, delete)
 * @param oldTransaction - Old transaction data (for update operations)
 * @param tx - Optional Prisma transaction client
 */
export async function updateBudgetForTransaction(
  transaction: {
    id?: string;
    accountId: string;
    categoryId: string | null;
    payeeId: string | null;
    userId: string;
    value: number | string;
    date: Date;
    categoryType?: 'INCOME' | 'EXPENSE' | null;
  },
  operation: 'create' | 'update' | 'delete',
  oldTransaction?: {
    accountId: string;
    categoryId: string | null;
    payeeId: string | null;
    value: number | string;
    date: Date;
    categoryType?: 'INCOME' | 'EXPENSE' | null;
  },
  tx?: PrismaTransaction | PrismaClient,
): Promise<void> {
  const client = tx ?? prisma;

  // Get category type if not provided
  let categoryType: 'INCOME' | 'EXPENSE' | null = transaction.categoryType ?? null;
  if (!categoryType && transaction.categoryId) {
    const category = await client.category.findUnique({
      where: {id: transaction.categoryId},
      select: {type: true},
    });
    categoryType = category?.type ?? null;
  }

  // Calculate spending change for current transaction
  let spendingChange = 0;
  if (operation === 'create') {
    spendingChange = calculateSpendingChange(transaction, categoryType);
  } else if (operation === 'update') {
    // For updates, calculate the difference
    const oldSpending = oldTransaction
      ? calculateSpendingChange(
          {
            value: oldTransaction.value,
            date: oldTransaction.date,
            categoryId: oldTransaction.categoryId,
          },
          oldTransaction.categoryType ?? null,
        )
      : 0;
    const newSpending = calculateSpendingChange(transaction, categoryType);
    spendingChange = newSpending - oldSpending;
  } else if (operation === 'delete') {
    // For deletes, subtract the spending
    spendingChange = -calculateSpendingChange(transaction, categoryType);
  }

  // If no spending change, no need to update budgets
  if (spendingChange === 0) {
    return;
  }

  // Find affected budgets
  const affectedBudgets = await findAffectedBudgets(transaction, client);

  // Update each affected budget
  for (const budget of affectedBudgets) {
    const newSpent = Math.max(0, budget.currentSpent + spendingChange);

    await client.budget.update({
      where: {id: budget.id},
      data: {currentSpent: newSpent},
    });

    // Check thresholds with updated budget
    const updatedBudget = {
      id: budget.id,
      amount: budget.amount,
      currentSpent: newSpent,
    };
    await checkBudgetThresholds(updatedBudget, transaction.userId, client);
  }
}

