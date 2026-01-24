/**
 * Example Data Resolver
 * Handles adding example data to the database
 */

import type { GraphQLContext } from '../middleware/context';
import { withPrismaErrorHandling } from '../utils/prismaErrors';
import { sanitizeUserInput } from '../utils/sanitization';
import { getUserDefaultWorkspace } from '../services/WorkspaceService';

export class ExampleDataResolver {
  /**
   * Add example data to database
   * Creates example categories and payees if they don't already exist
   * @param _ - Parent resolver (unused)
   * @param __ - Arguments (unused)
   * @param context - GraphQL context with user and database access
   * @returns True if successful
   */
  async addExampleData(
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
          // Example expense categories
          const expenseCategoryNames = [
            'Utilities & Bills',
            'Transportation',
            'Shopping',
            'Medical & Healthcare',
            'Education',
            'Entertainment',
            'Gifts & Donations',
            'Insurance',
            'Savings and Investments',
            'Miscellaneous',
            'Debt Payments',
          ];
          for (const name of expenseCategoryNames) {
            const existing = await tx.category.findFirst({
              where: {
                workspaceId,
                name,
              },
            });

            if (!existing) {
              await tx.category.create({
                data: {
                  name: sanitizeUserInput(name),
                  categoryType: 'Expense',
                  workspaceId,
                  createdBy: context.userId,
                  lastEditedBy: context.userId,
                  isDefault: false,
                },
              });
            }
          }

          // Example income categories
          const incomeCategoryNames = [
            'Collect Interest',
            'Cashback',
            'Gifts & Award',
            'Selling',
            'Transfer From Other Accounts',
            'Other Income',
          ];
          for (const name of incomeCategoryNames) {
            const existing = await tx.category.findFirst({
              where: {
                workspaceId,
                name,
              },
            });

            if (!existing) {
              await tx.category.create({
                data: {
                  name: sanitizeUserInput(name),
                  categoryType: 'Income',
                  workspaceId,
                  createdBy: context.userId,
                  lastEditedBy: context.userId,
                  isDefault: false,
                },
              });
            }
          }

          // Example payees
          const payeeNames = [
            'Education',
            'Play',
            'Financial Freedom',
            'Give',
            'Long-term Savings',
          ];
          for (const name of payeeNames) {
            const existing = await tx.payee.findFirst({
              where: {
                workspaceId,
                name,
              },
            });

            if (!existing) {
              await tx.payee.create({
                data: {
                  name: sanitizeUserInput(name),
                  workspaceId,
                  createdBy: context.userId,
                  lastEditedBy: context.userId,
                  isDefault: false,
                },
              });
            }
          }
        }),
      { resource: 'ExampleData', operation: 'create' }
    );

    return true;
  }
}
