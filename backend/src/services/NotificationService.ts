/**
 * Notification Service
 * Handles budget threshold notifications
 */

 
import type {PrismaClient} from '@prisma/client';
import {prisma} from '../utils/prisma';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Get budget name for notification message
 * @param budgetId - Budget ID
 * @param tx - Prisma transaction client
 * @returns Budget name (account, category, or payee name)
 */
async function getBudgetName(budgetId: string, tx: PrismaTransaction | PrismaClient): Promise<string> {
  const budget = await tx.budget.findUnique({
    where: {id: budgetId},
    include: {
      account: {select: {name: true}},
      category: {select: {name: true}},
      payee: {select: {name: true}},
    },
  });

  if (!budget) {
    return 'Budget';
  }

  if (budget.account) {
    return budget.account.name;
  }
  if (budget.category) {
    return budget.category.name;
  }
  if (budget.payee) {
    return budget.payee.name;
  }

  return 'Budget';
}

/**
 * Create a budget notification
 * @param userId - User ID
 * @param budgetId - Budget ID
 * @param threshold - Threshold percentage (50, 80, or 100)
 * @param tx - Optional Prisma transaction client
 * @returns Created notification
 */
export async function createBudgetNotification(
  userId: string,
  budgetId: string,
  threshold: number,
  tx?: PrismaTransaction | PrismaClient,
): Promise<void> {
  const client = tx ?? prisma;

  const budgetName = await getBudgetName(budgetId, client);
  const message = `Budget '${budgetName}' has reached ${threshold}%`;

  await client.budgetNotification.create({
    data: {
      userId,
      budgetId,
      threshold,
      message,
      read: false,
    },
  });
}

/**
 * Get budget notifications for a user
 * @param userId - User ID
 * @param read - Filter by read status (optional)
 * @returns Array of notifications
 */
export async function getBudgetNotifications(
  userId: string,
  read?: boolean,
): Promise<Array<{
  id: string;
  userId: string;
  budgetId: string;
  threshold: number;
  message: string;
  read: boolean;
  createdAt: Date;
}>> {
  const where: {userId: string; read?: boolean} = {userId};
  if (read !== undefined) {
    where.read = read;
  }

  const notifications = await prisma.budgetNotification.findMany({
    where,
    orderBy: {createdAt: 'desc'},
  });

  return notifications.map((n) => ({
    id: n.id,
    userId: n.userId,
    budgetId: n.budgetId,
    threshold: n.threshold,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt,
  }));
}

/**
 * Mark a notification as read
 * @param userId - User ID
 * @param notificationId - Notification ID
 * @returns true if successful
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<boolean> {
  await prisma.budgetNotification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      read: true,
    },
  });

  return true;
}

