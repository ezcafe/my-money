/**
 * Export Resolver
 * Handles data export for CSV generation
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type {GraphQLContext} from '../middleware/context';
import {withPrismaErrorHandling} from '../utils/prismaErrors';

/**
 * Export Resolver Class
 * Provides methods to export all user data
 */
export class ExportResolver {
  /**
   * Export all user data for CSV generation
   * Fetches accounts, categories, payees, transactions, recurringTransactions, and preferences
   * @param _ - Parent resolver (unused)
   * @param __ - Arguments (unused)
   * @param context - GraphQL context with user and Prisma client
   * @returns Export data containing all user entities
   */
  async exportData(_: unknown, __: unknown, context: GraphQLContext) {
    return await withPrismaErrorHandling(
      async () => {
        // Fetch all user data in parallel
        const [accounts, categories, payees, transactions, recurringTransactions, preferences] = await Promise.all([
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
        ]);

        return {
          accounts,
          categories,
          payees,
          transactions,
          recurringTransactions,
          preferences,
        };
      },
      {resource: 'ExportData', operation: 'read'},
    );
  }
}

