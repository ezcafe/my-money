/**
 * Export Resolver
 * Handles data export for CSV generation
 */


import type {GraphQLContext} from '../middleware/context';
import type {Account, Category, Payee, Transaction, RecurringTransaction, UserPreferences, Budget, ImportMatchRule} from '@prisma/client';
import {withPrismaErrorHandling} from '../utils/prismaErrors';

/**
 * Export Resolver Class
 * Provides methods to export all user data
 */
export class ExportResolver {
  /**
   * Export user data for CSV generation
   * Fetches user data including accounts, categories, payees, transactions,
   * recurringTransactions, preferences, budgets, and importMatchRules
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
    },
    context: GraphQLContext,
  ): Promise<{
    accounts: Account[];
    categories: Category[];
    payees: Payee[];
    transactions: Transaction[];
    recurringTransactions: RecurringTransaction[];
    preferences: UserPreferences | null;
    budgets: Budget[];
    importMatchRules: ImportMatchRule[];
  }> {
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
        } = args;

        // Build transaction where clause with filters
        const transactionWhere: {
          userId: string;
          date?: {gte?: Date; lte?: Date};
          accountId?: {in: string[]};
          categoryId?: {in: string[]} | null;
          payeeId?: {in: string[]} | null;
        } = {
          userId: context.userId,
        };

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
          transactionWhere.accountId = {in: accountIds};
        }

        if (categoryIds && categoryIds.length > 0) {
          transactionWhere.categoryId = {in: categoryIds};
        } else if (categoryIds?.length === 0) {
          transactionWhere.categoryId = null; // Export transactions with no category
        }

        if (payeeIds && payeeIds.length > 0) {
          transactionWhere.payeeId = {in: payeeIds};
        } else if (payeeIds?.length === 0) {
          transactionWhere.payeeId = null; // Export transactions with no payee
        }

        // Build recurring transaction where clause
        const recurringTransactionWhere: {
          userId: string;
          accountId?: {in: string[]};
          categoryId?: {in: string[]} | null;
          payeeId?: {in: string[]} | null;
        } = {
          userId: context.userId,
        };

        if (accountIds && accountIds.length > 0) {
          recurringTransactionWhere.accountId = {in: accountIds};
        }
        if (categoryIds && categoryIds.length > 0) {
          recurringTransactionWhere.categoryId = {in: categoryIds};
        }
        if (payeeIds && payeeIds.length > 0) {
          recurringTransactionWhere.payeeId = {in: payeeIds};
        }

        // Build budget where clause
        const budgetWhere: {
          userId: string;
          accountId?: {in: string[]} | null;
          categoryId?: {in: string[]} | null;
          payeeId?: {in: string[]} | null;
        } = {
          userId: context.userId,
        };

        if (accountIds && accountIds.length > 0) {
          budgetWhere.accountId = {in: accountIds};
        }
        if (categoryIds && categoryIds.length > 0) {
          budgetWhere.categoryId = {in: categoryIds};
        }
        if (payeeIds && payeeIds.length > 0) {
          budgetWhere.payeeId = {in: payeeIds};
        }

        // Fetch user data in parallel (always fetch reference data)
        const [
          accounts,
          categories,
          payees,
          transactions,
          recurringTransactions,
          preferences,
          budgets,
          importMatchRules,
        ] = await Promise.all([
          // Accounts (always included)
          context.prisma.account.findMany({
            where: {userId: context.userId},
            orderBy: {createdAt: 'asc'},
          }),
          // Categories (always included)
          context.prisma.category.findMany({
            where: {userId: context.userId},
            orderBy: {createdAt: 'asc'},
          }),
          // Payees (always included)
          context.prisma.payee.findMany({
            where: {userId: context.userId},
            orderBy: {createdAt: 'asc'},
          }),
          // Transactions (filtered if includeTransactions is true)
          includeTransactions
            ? context.prisma.transaction.findMany({
                where: transactionWhere,
                orderBy: {date: 'asc'},
              })
            : Promise.resolve([]),
          // Recurring Transactions (filtered if includeRecurringTransactions is true)
          includeRecurringTransactions
            ? context.prisma.recurringTransaction.findMany({
                where: recurringTransactionWhere,
                orderBy: {createdAt: 'asc'},
              })
            : Promise.resolve([]),
          // Preferences (always included)
          context.prisma.userPreferences.findUnique({
            where: {userId: context.userId},
          }),
          // Budgets (filtered if includeBudgets is true)
          includeBudgets
            ? context.prisma.budget.findMany({
                where: budgetWhere,
                orderBy: {createdAt: 'asc'},
              })
            : Promise.resolve([]),
          // Import Match Rules (always included)
          context.prisma.importMatchRule.findMany({
            where: {userId: context.userId},
            orderBy: {createdAt: 'asc'},
          }),
        ]);

        return {
          accounts,
          categories,
          payees,
          transactions,
          recurringTransactions,
          preferences,
          budgets,
          importMatchRules,
        };
      },
      {resource: 'ExportData', operation: 'read'},
    );
  }
}

