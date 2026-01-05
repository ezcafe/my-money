/**
 * Report Resolver
 * Handles report-related GraphQL operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type {GraphQLContext} from '../middleware/context';
import {z} from 'zod';
import {validate} from '../utils/validation';
import {ValidationError} from '../utils/errors';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {validateContext} from '../utils/baseResolver';

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
  ) {
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

    const where: {
      userId: string;
      accountId?: {in: string[]};
      categoryId?: {in: string[]} | null;
      payeeId?: {in: string[]} | null;
      date?: {gte?: Date; lte?: Date};
      note?: {contains: string; mode: 'insensitive'};
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
      // Verify all categories belong to user or are default categories
      const categories = await context.prisma.category.findMany({
        where: {
          id: {in: validatedInput.categoryIds},
          OR: [
            {userId: context.userId},
            {isDefault: true},
          ],
        },
      });

      if (categories.length !== validatedInput.categoryIds.length) {
        throw new ValidationError('One or more categories not found or not accessible');
      }

      where.categoryId = {in: validatedInput.categoryIds};
    }

    // Filter by payees
    if (validatedInput.payeeIds && validatedInput.payeeIds.length > 0) {
      // Verify all payees belong to user or are default payees
      const payees = await context.prisma.payee.findMany({
        where: {
          id: {in: validatedInput.payeeIds},
          OR: [
            {userId: context.userId},
            {isDefault: true},
          ],
        },
      });

      if (payees.length !== validatedInput.payeeIds.length) {
        throw new ValidationError('One or more payees not found or not accessible');
      }

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

    // Filter by note
    if (validatedInput.note) {
      where.note = {
        contains: validatedInput.note,
        mode: 'insensitive',
      };
    }

    // Build orderBy based on field type
    const orderField = orderBy?.field ?? 'date';
    const orderDirection = orderBy?.direction ?? 'desc';

    let prismaOrderBy: Record<string, string | Record<string, string>>;

    switch (orderField) {
      case 'date':
        prismaOrderBy = {date: orderDirection};
        break;
      case 'value':
        prismaOrderBy = {value: orderDirection};
        break;
      case 'category':
        prismaOrderBy = {category: {name: orderDirection}};
        break;
      case 'account':
        prismaOrderBy = {account: {name: orderDirection}};
        break;
      case 'payee':
        prismaOrderBy = {payee: {name: orderDirection}};
        break;
      default:
        prismaOrderBy = {date: orderDirection};
    }

    const limit = validatedInput.take ?? 100;
    const offset = validatedInput.skip ?? 0;

    // Run all queries in parallel to minimize database round-trips
    const [items, totalCount, totalAmountResult] = await Promise.all([
      context.prisma.transaction.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: prismaOrderBy,
        // Relations are loaded via DataLoaders in GraphQL field resolvers
        // This prevents N+1 query problems and reduces memory usage
      }),
      context.prisma.transaction.count({where}),
      context.prisma.transaction.aggregate({
        where,
        _sum: {
          value: true,
        },
      }),
    ]);

    const totalAmount = totalAmountResult._sum.value
      ? Number(totalAmountResult._sum.value)
      : 0;

        return {
          items,
          totalCount,
          totalAmount,
        };
      },
      {resource: 'Report', operation: 'read'},
    );
  }
}

