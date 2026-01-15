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
   * Export all user data for CSV generation
   * Fetches all user data including accounts, categories, payees, transactions,
   * recurringTransactions, preferences, budgets, and importMatchRules
   * @param _ - Parent resolver (unused)
   * @param __ - Arguments (unused)
   * @param context - GraphQL context with user and Prisma client
   * @returns Export data containing all user entities
   */
  async exportData(_: unknown, __: unknown, context: GraphQLContext): Promise<{
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
        // Fetch all user data in parallel
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
          // Accounts
          context.prisma.account.findMany({
            where: {userId: context.userId},
            orderBy: {createdAt: 'asc'},
          }),
          // Categories
          context.prisma.category.findMany({
            where: {userId: context.userId},
            orderBy: {createdAt: 'asc'},
          }),
          // Payees
          context.prisma.payee.findMany({
            where: {userId: context.userId},
            orderBy: {createdAt: 'asc'},
          }),
          // Transactions
          context.prisma.transaction.findMany({
            where: {userId: context.userId},
            orderBy: {date: 'asc'},
          }),
          // Recurring Transactions
          context.prisma.recurringTransaction.findMany({
            where: {userId: context.userId},
            orderBy: {createdAt: 'asc'},
          }),
          // Preferences
          context.prisma.userPreferences.findUnique({
            where: {userId: context.userId},
          }),
          // Budgets
          context.prisma.budget.findMany({
            where: {userId: context.userId},
            orderBy: {createdAt: 'asc'},
          }),
          // Import Match Rules
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

