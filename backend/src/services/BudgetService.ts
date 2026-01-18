/**
 * Budget Service
 * Handles budget updates and threshold checks
 * Tracks spending against budgets for accounts, categories, or payees
 */

import type {PrismaClient} from '@prisma/client';
import {prisma} from '../utils/prisma';
import {createBudgetNotification} from './NotificationService';
import {getContainer} from '../utils/container';

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
 * Only counts Expense transactions from current month
 * @param transaction - Transaction data
 * @param categoryType - Category type (Income or Expense)
 * @returns Spending change (positive for expenses, 0 for income or non-current-month)
 */
function calculateSpendingChange(
  transaction: {value: number | string; date: Date; categoryId: string | null},
  categoryType: 'Income' | 'Expense' | null,
): number {
  // Only count Expense transactions
  if (categoryType !== 'Expense') {
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
  transaction: {accountId: string; categoryId: string | null; payeeId: string | null},
  workspaceId: string,
  tx: PrismaTransaction | PrismaClient,
): Promise<Array<{id: string; amount: number; currentSpent: number}>> {
  const budgetRepository = getContainer().getBudgetRepository(tx);
  return budgetRepository.findAffectedByTransaction(transaction, workspaceId, tx);
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
  const container = getContainer();
  const budgetRepository = container.getBudgetRepository(client);
  const transactionRepository = container.getTransactionRepository(client);

  // Get budget with its criteria
  // Note: Budgets are workspace-scoped, so we fetch by ID only
  // The userId parameter is kept for backward compatibility but not used in the query
  const budget = await budgetRepository.findFirst(
    {
      id: budgetId,
    },
    {
      accountId: true,
      categoryId: true,
      payeeId: true,
    },
    tx,
  );

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
  // Filter by: user (via account), date range, category type EXPENSE, and budget criteria
  const transactions = await transactionRepository.findMany(
    {
      account: {
        createdBy: userId,
      },
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
      category: {
        categoryType: 'Expense',
      },
      ...(orConditions.length > 0 && {OR: orConditions}),
    },
    {
      include: {
        category: {
          select: {categoryType: true},
        },
      },
    },
  );

  // Calculate total spending (only EXPENSE transactions in current month)
  let totalSpent = 0;
  for (const transaction of transactions) {
    // Double-check category type (should already be filtered, but be safe)
    const transactionWithCategory = transaction as typeof transaction & {
      category?: {categoryType: 'Income' | 'Expense'};
    };
    if (transactionWithCategory.category?.categoryType === 'Expense' && isCurrentMonth(transaction.date)) {
      const value = Number(transaction.value);
      totalSpent += Math.abs(value);
    }
  }

  // Update budget with recalculated amount
  await budgetRepository.update(budgetId, {currentSpent: totalSpent}, tx);

  // Check thresholds with updated budget
  const budgetAmount = await budgetRepository.findUnique(budgetId, {amount: true}, tx);

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
    workspaceId: string;
    value: number | string;
    date: Date;
    categoryType?: 'Income' | 'Expense' | null;
  },
  operation: 'create' | 'update' | 'delete',
  oldTransaction?: {
    accountId: string;
    categoryId: string | null;
    payeeId: string | null;
    value: number | string;
    date: Date;
    categoryType?: 'Income' | 'Expense' | null;
  },
  tx?: PrismaTransaction | PrismaClient,
): Promise<void> {
  const client = tx ?? prisma;

  // Get category type if not provided
  const categoryRepository = getContainer().getCategoryRepository(client);
  let categoryType: 'Income' | 'Expense' | null = transaction.categoryType ?? null;
  if (!categoryType && transaction.categoryId) {
    const category = await categoryRepository.findById(transaction.categoryId, transaction.workspaceId, {categoryType: true});
    categoryType = category?.categoryType ?? null;
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
  const budgetRepository = getContainer().getBudgetRepository(client);
  const affectedBudgets = await findAffectedBudgets(
    {
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      payeeId: transaction.payeeId,
    },
    transaction.workspaceId,
    client,
  );

  // Update each affected budget
  for (const budget of affectedBudgets) {
    const newSpent = Math.max(0, budget.currentSpent + spendingChange);

    await budgetRepository.update(budget.id, {currentSpent: newSpent}, tx);

    // Check thresholds with updated budget
    const updatedBudget = {
      id: budget.id,
      amount: budget.amount,
      currentSpent: newSpent,
    };
    await checkBudgetThresholds(updatedBudget, transaction.userId, client);
  }
}

