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
import * as postgresCache from '../utils/postgresCache';
import {reportKey, hashFilters} from '../utils/cacheKeys';
import {checkWorkspaceAccess, getUserDefaultWorkspace} from '../services/WorkspaceService';
import {getContainer} from '../utils/container';
import {CACHE_TAGS} from '../utils/cacheTags';

const ReportTransactionsInputSchema = z.object({
  accountIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  payeeIds: z.array(z.string().uuid()).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  note: z.string().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(1000).optional(),
  memberIds: z.array(z.string().uuid()).optional(),
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
      memberIds,
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
      memberIds?: string[];
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

    // Get workspace ID from context (default to user's default workspace)
    const workspaceId = context.currentWorkspaceId ?? await getUserDefaultWorkspace(context.userId);

    // Verify workspace access
    await checkWorkspaceAccess(workspaceId, context.userId);

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
      memberIds,
    });

    const container = getContainer();
    const categoryRepository = container.getCategoryRepository(context.prisma);
    const payeeRepository = container.getPayeeRepository(context.prisma);
    const transactionRepository = container.getTransactionRepository(context.prisma);
    const accountRepository = container.getAccountRepository(context.prisma);

    // Verify entity access in workspace
    if (validatedInput.accountIds && validatedInput.accountIds.length > 0) {
      const accountPromises = validatedInput.accountIds.map(
        async (id: string) => accountRepository.findById(id, workspaceId, {id: true}),
      );
      const accounts = await Promise.all(accountPromises);
      if (accounts.some((a) => a === null)) {
        throw new NotFoundError('Account');
      }
    }

    if (validatedInput.categoryIds && validatedInput.categoryIds.length > 0) {
      const categoryPromises = validatedInput.categoryIds.map(
        async (id: string) => categoryRepository.findById(id, workspaceId, {id: true}),
      );
      const categories = await Promise.all(categoryPromises);
      if (categories.some((c) => c === null)) {
        throw new ValidationError('One or more categories not found or not accessible');
      }
    }

    if (validatedInput.payeeIds && validatedInput.payeeIds.length > 0) {
      const payeePromises = validatedInput.payeeIds.map(
        async (id: string) => payeeRepository.findById(id, workspaceId, {id: true}),
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
        memberIds: validatedInput.memberIds,
      },
      workspaceId,
    );

    // Build orderBy using utility function
    const prismaOrderBy = buildOrderBy(
      orderBy as {field: 'date' | 'value' | 'category' | 'account' | 'payee'; direction: 'asc' | 'desc'} | undefined,
    );

    const limit = validatedInput.take ?? 100;
    const offset = validatedInput.skip ?? 0;

    // Generate cache key from filter parameters (exclude pagination for aggregation cache)
    const filterHash = hashFilters({
      accountIds: validatedInput.accountIds,
      categoryIds: validatedInput.categoryIds,
      payeeIds: validatedInput.payeeIds,
      startDate: validatedInput.startDate,
      endDate: validatedInput.endDate,
      note: validatedInput.note,
      memberIds: validatedInput.memberIds,
      workspaceId,
    });
    const aggregationCacheKey = reportKey(context.userId, filterHash);
    const AGGREGATION_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

    // Try to get cached aggregation results
    const cachedAggregations = await postgresCache.get<{
      totalCount: number;
      totalAmount: number;
      totalIncome: number;
      totalExpense: number;
    }>(aggregationCacheKey);

    let totalCount: number;
    let totalAmount: number;
    let totalIncome: number;
    let totalExpense: number;

    if (cachedAggregations) {
      // Use cached aggregations
      ({totalCount, totalAmount, totalIncome, totalExpense} = cachedAggregations);
    } else {
      // Calculate aggregations from database
      const [totalCountResult, totalAmountResult, incomeExpenseTotals] = await Promise.all([
        transactionRepository.count(where),
        transactionRepository.aggregate(where, {
          _sum: {
            value: true,
          },
        }),
        // Use database-level aggregation for efficient calculation
        transactionRepository.calculateIncomeExpenseTotals(where),
      ]);

      totalCount = totalCountResult;
      totalAmount = totalAmountResult._sum?.value
        ? Number(totalAmountResult._sum.value)
        : 0;
      ({totalIncome, totalExpense} = incomeExpenseTotals);

      // Cache aggregation results (fire and forget)
      const cacheTags = [CACHE_TAGS.REPORTS(workspaceId), CACHE_TAGS.TRANSACTIONS(workspaceId)];
      void postgresCache.set(aggregationCacheKey, {
        totalCount,
        totalAmount,
        totalIncome,
        totalExpense,
      }, AGGREGATION_CACHE_TTL_MS, cacheTags).catch(() => {
        // Ignore cache errors
      });
    }

    // Always fetch items (not cached due to pagination)
    const items = await transactionRepository.findMany(where, {
      skip: offset,
      take: limit,
      orderBy: prismaOrderBy,
      // Relations are loaded via DataLoaders in GraphQL field resolvers
      // This prevents N+1 query problems and reduces memory usage
    });

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

