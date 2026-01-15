/**
 * Report Resolver
 * Handles report-related GraphQL operations
 */


import type {GraphQLContext} from '../middleware/context';
import type {Transaction} from '@prisma/client';
import {z} from 'zod';
import {validate} from '../utils/validation';
import {ValidationError, NotFoundError} from '../utils/errors';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {validateContext} from '../utils/baseResolver';
import {buildOrderBy, buildTransactionWhere} from '../utils/queryBuilder';
import {AccountRepository} from '../repositories/AccountRepository';
import {CategoryRepository} from '../repositories/CategoryRepository';
import {PayeeRepository} from '../repositories/PayeeRepository';
import {TransactionRepository} from '../repositories/TransactionRepository';

const ReportTransactionsInputSchema = z.object({
  accountIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  payeeIds: z.array(z.string().uuid()).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  note: z.string().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(1000).optional(),
});

export class ReportResolver {
  /**
   * Get report transactions with filters
   */
  async reportTransactions(
    _: unknown,
    {
      accountIds,
      categoryIds,
      payeeIds,
      startDate,
      endDate,
      note,
      orderBy,
      skip,
      take,
    }: {
      accountIds?: string[];
      categoryIds?: string[];
      payeeIds?: string[];
      startDate?: Date;
      endDate?: Date;
      note?: string;
      orderBy?: {field: string; direction: string};
      skip?: number;
      take?: number;
    },
    context: GraphQLContext,
  ): Promise<{
    items: Transaction[];
    totalCount: number;
    totalAmount: number;
    totalIncome: number;
    totalExpense: number;
  }> {
    validateContext(context);
    return await withPrismaErrorHandling(
      async () => {
    const validatedInput = validate(ReportTransactionsInputSchema, {
      accountIds,
      categoryIds,
      payeeIds,
      startDate,
      endDate,
      note,
      skip,
      take,
    });

    const categoryRepository = new CategoryRepository(context.prisma);
    const payeeRepository = new PayeeRepository(context.prisma);
    const transactionRepository = new TransactionRepository(context.prisma);

    // Verify entity access
    if (validatedInput.accountIds && validatedInput.accountIds.length > 0) {
      const accountRepository = new AccountRepository(context.prisma);
      const accountPromises = validatedInput.accountIds.map(
        async (id: string) => accountRepository.findById(id, context.userId, {id: true}),
      );
      const accounts = await Promise.all(accountPromises);
      if (accounts.some((a) => a === null)) {
        throw new NotFoundError('Account');
      }
    }

    if (validatedInput.categoryIds && validatedInput.categoryIds.length > 0) {
      const categoryPromises = validatedInput.categoryIds.map(
        async (id: string) => categoryRepository.findById(id, context.userId, {id: true}),
      );
      const categories = await Promise.all(categoryPromises);
      if (categories.some((c) => c === null)) {
        throw new ValidationError('One or more categories not found or not accessible');
      }
    }

    if (validatedInput.payeeIds && validatedInput.payeeIds.length > 0) {
      const payeePromises = validatedInput.payeeIds.map(
        async (id: string) => payeeRepository.findById(id, context.userId, {id: true}),
      );
      const payees = await Promise.all(payeePromises);
      if (payees.some((p) => p === null)) {
        throw new ValidationError('One or more payees not found or not accessible');
      }
    }

    // Build where clause using utility function
    const where = buildTransactionWhere(
      {
        accountIds: validatedInput.accountIds,
        categoryIds: validatedInput.categoryIds,
        payeeIds: validatedInput.payeeIds,
        startDate: validatedInput.startDate,
        endDate: validatedInput.endDate,
        note: validatedInput.note,
      },
      context.userId,
    );

    // Build orderBy using utility function
    const prismaOrderBy = buildOrderBy(
      orderBy as {field: 'date' | 'value' | 'category' | 'account' | 'payee'; direction: 'asc' | 'desc'} | undefined,
    );

    const limit = validatedInput.take ?? 100;
    const offset = validatedInput.skip ?? 0;

    // Run all queries in parallel to minimize database round-trips
    // Use database-level aggregation for income/expense totals (optimized)
    const [items, totalCount, totalAmountResult, incomeExpenseTotals] = await Promise.all([
      transactionRepository.findMany(where, {
        skip: offset,
        take: limit,
        orderBy: prismaOrderBy,
        // Relations are loaded via DataLoaders in GraphQL field resolvers
        // This prevents N+1 query problems and reduces memory usage
      }),
      transactionRepository.count(where),
      transactionRepository.aggregate(where, {
        _sum: {
          value: true,
        },
      }),
      // Use database-level aggregation for efficient calculation
      transactionRepository.calculateIncomeExpenseTotals(where),
    ]);

    const totalAmount = totalAmountResult._sum?.value
      ? Number(totalAmountResult._sum.value)
      : 0;

    // Income and expense totals are calculated at database level
    const {totalIncome, totalExpense} = incomeExpenseTotals;

        return {
          items,
          totalCount,
          totalAmount,
          totalIncome,
          totalExpense,
        };
      },
      {resource: 'Report', operation: 'read'},
    );
  }
}

