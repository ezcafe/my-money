/**
 * Export Resolver
 * Handles data export for CSV generation
 */

import type { GraphQLContext } from '../middleware/context';
import type {
  Account,
  Category,
  Payee,
  Transaction,
  RecurringTransaction,
  UserSettings,
  Budget,
  ImportMatchRule,
  Prisma,
} from '@prisma/client';
import { withPrismaErrorHandling } from '../utils/prismaErrors';
import { NotFoundError } from '../utils/errors';
import {
  checkWorkspaceAccess,
  getUserDefaultWorkspace,
} from '../services/WorkspaceService';

/**
 * Export Resolver Class
 * Provides methods to export all user data
 */
export class ExportResolver {
  /**
   * Export user data for CSV generation
   * Fetches user data including accounts, categories, payees, transactions,
   * recurringTransactions, settings, budgets, and importMatchRules
   * Supports filtering by date range and other criteria
   * @param _ - Parent resolver (unused)
   * @param args - Export arguments with optional filters
   * @param context - GraphQL context with user and Prisma client
   * @returns Export data containing filtered user entities
   */
  async exportData(
    _: unknown,
    args: {
      startDate?: Date;
      endDate?: Date;
      accountIds?: string[];
      categoryIds?: string[];
      payeeIds?: string[];
      includeTransactions?: boolean;
      includeRecurringTransactions?: boolean;
      includeBudgets?: boolean;
      memberIds?: string[];
    },
    context: GraphQLContext
  ): Promise<{
    accounts: Account[];
    categories: Category[];
    payees: Payee[];
    transactions: Transaction[];
    recurringTransactions: RecurringTransaction[];
    settings: UserSettings | null;
    budgets: Budget[];
    importMatchRules: ImportMatchRule[];
  }> {
    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access - fallback to default workspace if current workspace doesn't exist
    let finalWorkspaceId = workspaceId;
    try {
      await checkWorkspaceAccess(workspaceId, context.userId);
    } catch (error) {
      // If workspace doesn't exist, fall back to user's default workspace
      if (
        error instanceof NotFoundError &&
        error.message.includes('Workspace')
      ) {
        finalWorkspaceId = await getUserDefaultWorkspace(context.userId);
        await checkWorkspaceAccess(finalWorkspaceId, context.userId);
        // Update context so subsequent operations use the correct workspace
        context.currentWorkspaceId = finalWorkspaceId;
      } else {
        throw error;
      }
    }

    return await withPrismaErrorHandling(
      async () => {
        const {
          startDate,
          endDate,
          accountIds,
          categoryIds,
          payeeIds,
          includeTransactions = true,
          includeRecurringTransactions = true,
          includeBudgets = true,
          memberIds,
        } = args;

        // Build transaction where clause with filters
        const transactionWhere: {
          account: { workspaceId: string };
          date?: { gte?: Date; lte?: Date };
          accountId?: { in: string[] };
          categoryId?: { in: string[] } | null;
          payeeId?: { in: string[] } | null;
          OR?: Array<
            { createdBy: { in: string[] } } | { lastEditedBy: { in: string[] } }
          >;
        } = {
          account: { workspaceId },
        };

        // Filter by memberIds if provided (createdBy or lastEditedBy)
        if (memberIds && memberIds.length > 0) {
          transactionWhere.OR = [
            { createdBy: { in: memberIds } },
            { lastEditedBy: { in: memberIds } },
          ];
        }

        if (startDate || endDate) {
          transactionWhere.date = {};
          if (startDate) {
            transactionWhere.date.gte = startDate;
          }
          if (endDate) {
            transactionWhere.date.lte = endDate;
          }
        }

        if (accountIds && accountIds.length > 0) {
          transactionWhere.accountId = { in: accountIds };
        }

        if (categoryIds && categoryIds.length > 0) {
          transactionWhere.categoryId = { in: categoryIds };
        } else if (categoryIds?.length === 0) {
          transactionWhere.categoryId = null; // Export transactions with no category
        }

        if (payeeIds && payeeIds.length > 0) {
          transactionWhere.payeeId = { in: payeeIds };
        } else if (payeeIds?.length === 0) {
          transactionWhere.payeeId = null; // Export transactions with no payee
        }

        // Build recurring transaction where clause (inherits workspace from account)
        const recurringTransactionWhere: {
          account: { workspaceId: string };
          accountId?: { in: string[] };
          categoryId?: { in: string[] } | null;
          payeeId?: { in: string[] } | null;
        } = {
          account: { workspaceId },
        };

        if (accountIds && accountIds.length > 0) {
          recurringTransactionWhere.accountId = { in: accountIds };
        }
        if (categoryIds && categoryIds.length > 0) {
          recurringTransactionWhere.categoryId = { in: categoryIds };
        }
        if (payeeIds && payeeIds.length > 0) {
          recurringTransactionWhere.payeeId = { in: payeeIds };
        }

        // Build budget where clause
        const budgetWhere: {
          workspaceId: string;
          accountId?: { in: string[] } | null;
          categoryId?: { in: string[] } | null;
          payeeId?: { in: string[] } | null;
          OR?: Array<
            { createdBy: { in: string[] } } | { lastEditedBy: { in: string[] } }
          >;
        } = {
          workspaceId,
        };

        // Filter by memberIds if provided (createdBy or lastEditedBy)
        if (memberIds && memberIds.length > 0) {
          budgetWhere.OR = [
            { createdBy: { in: memberIds } },
            { lastEditedBy: { in: memberIds } },
          ];
        }

        if (accountIds && accountIds.length > 0) {
          budgetWhere.accountId = { in: accountIds };
        }
        if (categoryIds && categoryIds.length > 0) {
          budgetWhere.categoryId = { in: categoryIds };
        }
        if (payeeIds && payeeIds.length > 0) {
          budgetWhere.payeeId = { in: payeeIds };
        }

        // Build where clauses for accounts, categories, payees with memberIds filtering
        const accountWhere: Prisma.AccountWhereInput = { workspaceId };
        if (memberIds && memberIds.length > 0) {
          accountWhere.OR = [
            { createdBy: { in: memberIds } },
            { lastEditedBy: { in: memberIds } },
          ];
        }

        const categoryWhere: Prisma.CategoryWhereInput = { workspaceId };
        if (memberIds && memberIds.length > 0) {
          categoryWhere.OR = [
            { createdBy: { in: memberIds } },
            { lastEditedBy: { in: memberIds } },
          ];
        }

        const payeeWhere: Prisma.PayeeWhereInput = { workspaceId };
        if (memberIds && memberIds.length > 0) {
          payeeWhere.OR = [
            { createdBy: { in: memberIds } },
            { lastEditedBy: { in: memberIds } },
          ];
        }

        // Fetch user data in parallel (always fetch reference data)
        const [
          accounts,
          categories,
          payees,
          transactions,
          recurringTransactions,
          settings,
          budgets,
          importMatchRules,
        ] = await Promise.all([
          // Accounts (always included)
          context.prisma.account.findMany({
            where: accountWhere,
            orderBy: { createdAt: 'asc' },
          }),
          // Categories (always included)
          context.prisma.category.findMany({
            where: categoryWhere,
            orderBy: { createdAt: 'asc' },
          }),
          // Payees (always included)
          context.prisma.payee.findMany({
            where: payeeWhere,
            orderBy: { createdAt: 'asc' },
          }),
          // Transactions (filtered if includeTransactions is true)
          includeTransactions
            ? context.prisma.transaction.findMany({
                where: transactionWhere,
                orderBy: { date: 'asc' },
              })
            : Promise.resolve([]),
          // Recurring Transactions (filtered if includeRecurringTransactions is true)
          includeRecurringTransactions
            ? context.prisma.recurringTransaction.findMany({
                where: recurringTransactionWhere,
                orderBy: { createdAt: 'asc' },
              })
            : Promise.resolve([]),
          // Settings (always included)
          context.prisma.userSettings.findUnique({
            where: { userId: context.userId },
          }),
          // Budgets (filtered if includeBudgets is true)
          includeBudgets
            ? context.prisma.budget.findMany({
                where: budgetWhere,
                orderBy: { createdAt: 'asc' },
              })
            : Promise.resolve([]),
          // Import Match Rules (always included)
          context.prisma.importMatchRule.findMany({
            where: { userId: context.userId },
            orderBy: { createdAt: 'asc' },
          }),
        ]);

        return {
          accounts,
          categories,
          payees,
          transactions,
          recurringTransactions,
          settings,
          budgets,
          importMatchRules,
        };
      },
      { resource: 'ExportData', operation: 'read' }
    );
  }
}
