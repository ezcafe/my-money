/**
 * Reset Data Resolver
 * Handles resetting all user data except default entities
 */

import type { GraphQLContext } from '../middleware/context';
import { withPrismaErrorHandling } from '../utils/prismaErrors';
import { getUserDefaultWorkspace } from '../services/WorkspaceService';

export class ResetDataResolver {
  /**
   * Reset all user data except default account, category, and payee
   * Deletes all transactions, recurring transactions, imported transactions,
   * import match rules, budgets, budget notifications, and non-default accounts/categories/payees
   * Resets default account balance to initBalance
   * @param _ - Parent resolver (unused)
   * @param __ - Arguments (unused)
   * @param context - GraphQL context with user and database access
   * @returns True if successful
   */
  async resetData(
    _: unknown,
    __: unknown,
    context: GraphQLContext
  ): Promise<boolean> {
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    await withPrismaErrorHandling(
      async () =>
        await context.prisma.$transaction(async (tx) => {
          // Delete all transactions for the user (through account relation)
          await tx.transaction.deleteMany({
            where: {
              account: {
                createdBy: context.userId,
              },
            },
          });

          // Delete all recurring transactions for the user (through account relation)
          await tx.recurringTransaction.deleteMany({
            where: {
              account: {
                createdBy: context.userId,
              },
            },
          });

          // Delete all imported transactions for the user
          await tx.importedTransaction.deleteMany({
            where: {
              userId: context.userId,
            },
          });

          // Delete all import match rules for the user
          await tx.importMatchRule.deleteMany({
            where: {
              userId: context.userId,
            },
          });

          // Delete all budget notifications for the user
          await tx.budgetNotification.deleteMany({
            where: {
              userId: context.userId,
            },
          });

          // Delete all budgets for the workspace
          await tx.budget.deleteMany({
            where: {
              workspaceId,
            },
          });

          // Delete all non-default accounts (preserve default account)
          await tx.account.deleteMany({
            where: {
              workspaceId,
              isDefault: false,
            },
          });

          // Delete all non-default categories (preserve default categories)
          await tx.category.deleteMany({
            where: {
              workspaceId,
              isDefault: false,
            },
          });

          // Delete all non-default payees (preserve default payees)
          await tx.payee.deleteMany({
            where: {
              workspaceId,
              isDefault: false,
            },
          });

          // Reset default account balance to initBalance
          const defaultAccount = await tx.account.findFirst({
            where: {
              workspaceId,
              isDefault: true,
            },
          });

          if (defaultAccount) {
            await tx.account.update({
              where: { id: defaultAccount.id },
              data: {
                balance: defaultAccount.initBalance,
              },
            });
          }
        }),
      { resource: 'ResetData', operation: 'reset' }
    );

    return true;
  }
}
