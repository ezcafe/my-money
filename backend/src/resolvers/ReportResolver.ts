/**
 * Report Resolver
 * Handles report-related GraphQL operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type {GraphQLContext} from '../middleware/context';
import {z} from 'zod';
import {validate} from '../utils/validation';

const ReportTransactionsInputSchema = z.object({
  accountIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  payeeIds: z.array(z.string().uuid()).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
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
      skip,
      take,
    }: {
      accountIds?: string[];
      categoryIds?: string[];
      payeeIds?: string[];
      startDate?: Date;
      endDate?: Date;
      skip?: number;
      take?: number;
    },
    context: GraphQLContext,
  ) {
    const validatedInput = validate(ReportTransactionsInputSchema, {
      accountIds,
      categoryIds,
      payeeIds,
      startDate,
      endDate,
      skip,
      take,
    });

    const where: {
      userId: string;
      accountId?: {in: string[]};
      categoryId?: {in: string[]} | null;
      payeeId?: {in: string[]} | null;
      date?: {gte?: Date; lte?: Date};
    } = {
      userId: context.userId,
    };

    // Filter by accounts
    if (validatedInput.accountIds && validatedInput.accountIds.length > 0) {
      // Verify all accounts belong to user
      const accounts = await context.prisma.account.findMany({
        where: {
          id: {in: validatedInput.accountIds},
          userId: context.userId,
        },
      });

      if (accounts.length !== validatedInput.accountIds.length) {
        throw new Error('One or more accounts not found or do not belong to user');
      }

      where.accountId = {in: validatedInput.accountIds};
    }

    // Filter by categories
    if (validatedInput.categoryIds && validatedInput.categoryIds.length > 0) {
      where.categoryId = {in: validatedInput.categoryIds};
    }

    // Filter by payees
    if (validatedInput.payeeIds && validatedInput.payeeIds.length > 0) {
      where.payeeId = {in: validatedInput.payeeIds};
    }

    // Filter by date range
    if (validatedInput.startDate || validatedInput.endDate) {
      where.date = {};
      if (validatedInput.startDate) {
        where.date.gte = validatedInput.startDate;
      }
      if (validatedInput.endDate) {
        where.date.lte = validatedInput.endDate;
      }
    }

    const limit = validatedInput.take ?? 100;
    const offset = validatedInput.skip ?? 0;

    const [items, totalCount] = await Promise.all([
      context.prisma.transaction.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: {date: 'desc'},
        include: {
          account: true,
          category: true,
          payee: true,
        },
      }),
      context.prisma.transaction.count({where}),
    ]);

    // Calculate total amount
    const totalAmountResult = await context.prisma.transaction.aggregate({
      where,
      _sum: {
        value: true,
      },
    });

    const totalAmount = totalAmountResult._sum.value
      ? Number(totalAmountResult._sum.value)
      : 0;

    return {
      items,
      totalCount,
      totalAmount,
    };
  }
}

