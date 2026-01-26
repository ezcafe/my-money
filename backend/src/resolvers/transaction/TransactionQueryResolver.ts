/**
 * Transaction Query Resolver
 * Handles all transaction-related GraphQL queries
 */

import type { GraphQLContext } from '../../middleware/context';
import type { Transaction } from '@prisma/client';
import { NotFoundError } from '../../utils/errors';
import { withPrismaErrorHandling } from '../../utils/prismaErrors';
import { buildOrderBy } from '../../utils/queryBuilder';
import { BaseResolver } from '../BaseResolver';
import * as postgresCache from '../../utils/postgresCache';
import { transactionQueryKey, hashFilters } from '../../utils/cacheKeys';
import {
  checkWorkspaceAccess,
  getUserDefaultWorkspace,
} from '../../services/WorkspaceService';
import { getContainer } from '../../utils/container';
import { CACHE_TAGS } from '../../utils/cacheTags';

/**
 * Transaction Query Resolver
 * Handles all transaction query operations
 */
export class TransactionQueryResolver extends BaseResolver {
  /**
   * Get transactions with pagination
   */
  async transactions(
    _: unknown,
    {
      accountId,
      categoryId,
      payeeId,
      first,
      after,
      last,
      before,
      orderBy,
      note,
    }: {
      accountId?: string;
      categoryId?: string;
      payeeId?: string;
      first?: number;
      after?: string;
      last?: number;
      before?: string;
      orderBy?: {
        field: 'date' | 'value' | 'category' | 'account' | 'payee';
        direction: 'asc' | 'desc';
      };
      note?: string;
    },
    context: GraphQLContext
  ): Promise<{
    items: Transaction[];
    totalCount: number;
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    // Cursor-based pagination (offset-based for compatibility)
    // Note: For better performance with large datasets, consider migrating to true cursor-based
    // pagination using record IDs or timestamps instead of offsets
    let limit = first ?? last ?? 20;
    let offset = 0;

    // Parse cursor (base64 encoded JSON with offset and orderBy info)
    if (after) {
      try {
        const cursorData = JSON.parse(
          Buffer.from(after, 'base64').toString('utf-8')
        ) as { offset: number; orderBy?: string };
        offset = cursorData.offset ?? 0;
        // Validate orderBy matches if provided in cursor
        if (cursorData.orderBy && orderBy) {
          const cursorOrderBy = `${orderBy.field}:${orderBy.direction}`;
          if (cursorData.orderBy !== cursorOrderBy) {
            // OrderBy changed, reset to start
            offset = 0;
          }
        }
      } catch {
        // Fallback to simple offset parsing for backward compatibility
        try {
          offset = Number.parseInt(
            Buffer.from(after, 'base64').toString('utf-8'),
            10
          );
        } catch {
          offset = 0;
        }
      }
    } else if (before) {
      try {
        const cursorData = JSON.parse(
          Buffer.from(before, 'base64').toString('utf-8')
        ) as { offset: number; orderBy?: string };
        const beforeOffset = cursorData.offset ?? 0;
        offset = Math.max(0, beforeOffset - (last ?? 20));
      } catch {
        // Fallback to simple offset parsing for backward compatibility
        try {
          const beforeOffset = Number.parseInt(
            Buffer.from(before, 'base64').toString('utf-8'),
            10
          );
          offset = Math.max(0, beforeOffset - (last ?? 20));
        } catch {
          offset = 0;
        }
      }
    }

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
      if (error instanceof NotFoundError && error.message.includes('Workspace')) {
        finalWorkspaceId = await getUserDefaultWorkspace(context.userId);
        await checkWorkspaceAccess(finalWorkspaceId, context.userId);
        // Update context so subsequent operations use the correct workspace
        context.currentWorkspaceId = finalWorkspaceId;
      } else {
        throw error;
      }
    }

    // Enforce maximum page size
    const MAX_PAGE_SIZE = 100;
    limit = Math.min(limit, MAX_PAGE_SIZE);
    const container = getContainer();
    const transactionRepository = container.getTransactionRepository(
      context.prisma
    );
    const categoryRepository = container.getCategoryRepository(context.prisma);
    const payeeRepository = container.getPayeeRepository(context.prisma);
    const accountRepository = container.getAccountRepository(context.prisma);

    const where: {
      account: { workspaceId: string };
      accountId?: string;
      categoryId?: string | null;
      payeeId?: string | null;
      note?: { contains: string; mode: 'insensitive' };
    } = {
      account: { workspaceId: finalWorkspaceId },
    };

    if (accountId) {
      // Verify account belongs to workspace
      const account = await accountRepository.findById(accountId, finalWorkspaceId, {
        id: true,
      });
      if (!account) {
        throw new NotFoundError('Account');
      }
      where.accountId = accountId;
    }

    if (categoryId) {
      // Verify category exists and is accessible in workspace
      const category = await categoryRepository.findById(
        categoryId,
        finalWorkspaceId,
        { id: true }
      );

      if (!category) {
        throw new NotFoundError('Category');
      }

      where.categoryId = categoryId;
    }

    if (payeeId) {
      // Verify payee exists and is accessible in workspace
      const payee = await payeeRepository.findById(payeeId, finalWorkspaceId, {
        id: true,
      });

      if (!payee) {
        throw new NotFoundError('Payee');
      }

      where.payeeId = payeeId;
    }

    // Add note filtering if provided
    if (note) {
      where.note = {
        contains: note,
        mode: 'insensitive',
      };
    }

    // Build orderBy based on field type
    const prismaOrderBy = buildOrderBy(orderBy);

    // Generate cache key from filter parameters (exclude pagination)
    const filterHash = hashFilters({
      accountId,
      categoryId,
      payeeId,
      note,
      orderBy: orderBy ? `${orderBy.field}:${orderBy.direction}` : undefined,
      workspaceId: finalWorkspaceId,
    });
    const cacheKey = transactionQueryKey(context.userId, filterHash);
    const TRANSACTION_QUERY_CACHE_TTL_MS = 30 * 1000; // 30 seconds

    // Try to get cached totalCount
    const cachedTotalCount = await postgresCache.get<number>(cacheKey);

    let totalCount: number;
    if (cachedTotalCount !== null) {
      totalCount = cachedTotalCount;
    } else {
      // Fetch totalCount from database
      totalCount = await transactionRepository.count(where);

      // Cache totalCount (fire and forget)
      const cacheTags = [
        CACHE_TAGS.TRANSACTIONS(finalWorkspaceId),
        CACHE_TAGS.TRANSACTION_QUERIES(finalWorkspaceId),
      ];
      void postgresCache
        .set(cacheKey, totalCount, TRANSACTION_QUERY_CACHE_TTL_MS, cacheTags)
        .catch(() => {
          // Ignore cache errors
        });
    }

    // Always fetch items (not cached due to pagination and frequent updates)
    const items = await transactionRepository.findMany(where, {
      skip: offset,
      take: limit + 1, // Fetch one extra to determine hasMore
      orderBy: prismaOrderBy,
      // Relations are loaded via DataLoaders in GraphQL field resolvers
      // This prevents N+1 query problems
    });

    const hasMore = items.length > limit;
    const transactions = hasMore ? items.slice(0, limit) : items;

    // Generate cursor for next page (base64 encoded JSON with offset and orderBy)
    // This allows validation of orderBy consistency across pagination
    const nextCursor = hasMore
      ? Buffer.from(
          JSON.stringify({
            offset: offset + limit,
            orderBy: orderBy
              ? `${orderBy.field}:${orderBy.direction}`
              : 'date:desc',
          }),
          'utf-8'
        ).toString('base64')
      : null;

    return {
      items: transactions,
      totalCount,
      hasMore,
      nextCursor,
    };
  }

  /**
   * Get last N transactions for home page
   * @param limit - Maximum number of transactions to return
   * @param orderBy - Ordering configuration with field and direction
   */
  async recentTransactions(
    _: unknown,
    {
      limit = 30,
      orderBy,
    }: {
      limit?: number;
      orderBy?: {
        field: 'date' | 'value' | 'category' | 'account' | 'payee';
        direction: 'asc' | 'desc';
      };
    },
    context: GraphQLContext
  ): Promise<Transaction[]> {
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
      if (error instanceof NotFoundError && error.message.includes('Workspace')) {
        finalWorkspaceId = await getUserDefaultWorkspace(context.userId);
        await checkWorkspaceAccess(finalWorkspaceId, context.userId);
        // Update context so subsequent operations use the correct workspace
        context.currentWorkspaceId = finalWorkspaceId;
      } else {
        throw error;
      }
    }

    // Build Prisma orderBy based on field type
    const prismaOrderBy = buildOrderBy(orderBy);

    const transactionRepository = getContainer().getTransactionRepository(
      context.prisma
    );

    // Get transactions with ordering
    // Relations are loaded via DataLoaders in GraphQL field resolvers
    // This prevents N+1 query problems and reduces memory usage
    const transactions = await transactionRepository.findMany(
      { account: { workspaceId: finalWorkspaceId } },
      {
        take: limit,
        orderBy: prismaOrderBy,
      }
    );

    return transactions;
  }

  /**
   * Get transaction by ID
   */
  async transaction(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<Transaction | null> {
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
      if (error instanceof NotFoundError && error.message.includes('Workspace')) {
        finalWorkspaceId = await getUserDefaultWorkspace(context.userId);
        await checkWorkspaceAccess(finalWorkspaceId, context.userId);
        // Update context so subsequent operations use the correct workspace
        context.currentWorkspaceId = finalWorkspaceId;
      } else {
        throw error;
      }
    }

    const transactionRepository = getContainer().getTransactionRepository(
      context.prisma
    );
    const transaction = await transactionRepository.findById(
      id,
      finalWorkspaceId,
      undefined,
      {
        account: true,
        category: true,
        payee: true,
      }
    );

    return transaction;
  }

  /**
   * Get top 5 most used transaction values from recent transactions
   * @param days - Number of days to look back (default: 90)
   * @returns Array of top used values with their counts
   */
  async topUsedValues(
    _: unknown,
    { days = 90 }: { days?: number },
    context: GraphQLContext
  ): Promise<Array<{ value: string; count: number }>> {
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

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
      if (error instanceof NotFoundError && error.message.includes('Workspace')) {
        finalWorkspaceId = await getUserDefaultWorkspace(context.userId);
        await checkWorkspaceAccess(finalWorkspaceId, context.userId);
        // Update context so subsequent operations use the correct workspace
        context.currentWorkspaceId = finalWorkspaceId;
      } else {
        throw error;
      }
    }

    const transactionRepository = getContainer().getTransactionRepository(
      context.prisma
    );

    // Use Prisma groupBy to get values with counts
    // Note: Prisma groupBy doesn't support orderBy with _count, so we sort in JavaScript
    const results = await withPrismaErrorHandling(
      async () =>
        await transactionRepository.groupBy(
          ['value'],
          {
            account: { workspaceId: finalWorkspaceId },
            date: {
              gte: startDate,
            },
          },
          {
            _count: {
              value: true,
            },
          }
        ),
      { resource: 'Transaction', operation: 'topUsedValues' }
    );

    // Sort by count descending and take top 5
    const sortedResults = results
      .sort((a, b) => (b._count?.value ?? 0) - (a._count?.value ?? 0))
      .slice(0, 5);

    // Transform results to match GraphQL schema
    // Convert Decimal to string to preserve decimal precision (.00)
    return sortedResults.map((result) => ({
      value: String(result.value),
      count: result._count?.value ?? 0,
    }));
  }

  /**
   * Get most commonly used account, payee, and category for a specific amount
   * @param amount - Transaction amount to match
   * @param days - Number of days to look back (default: 90)
   * @returns Most used transaction details or null if no matches
   */
  async mostUsedTransactionDetails(
    _: unknown,
    { amount, days = 90 }: { amount: number; days?: number },
    context: GraphQLContext
  ): Promise<{
    accountId: string | null;
    payeeId: string | null;
    categoryId: string | null;
    count: number;
  } | null> {
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

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
      if (error instanceof NotFoundError && error.message.includes('Workspace')) {
        finalWorkspaceId = await getUserDefaultWorkspace(context.userId);
        await checkWorkspaceAccess(finalWorkspaceId, context.userId);
        // Update context so subsequent operations use the correct workspace
        context.currentWorkspaceId = finalWorkspaceId;
      } else {
        throw error;
      }
    }

    const transactionRepository = getContainer().getTransactionRepository(
      context.prisma
    );

    // Use Prisma groupBy to get combinations with counts
    // Group by accountId, payeeId, categoryId to find most common combination
    const results = await withPrismaErrorHandling(
      async () =>
        await transactionRepository.groupBy(
          ['accountId', 'payeeId', 'categoryId'],
          {
            account: { workspaceId: finalWorkspaceId },
            value: amount, // Exact amount match
            date: {
              gte: startDate,
            },
          },
          {
            _count: {
              accountId: true,
            },
            _max: {
              date: true,
            },
          }
        ),
      { resource: 'Transaction', operation: 'mostUsedTransactionDetails' }
    );

    if (results.length === 0) {
      return null;
    }

    // Sort by count descending, then by most recent date for tie-breaking
    const sortedResults = results.sort((a, b) => {
      const countA = a._count?.accountId ?? 0;
      const countB = b._count?.accountId ?? 0;

      // First sort by count (descending)
      if (countB !== countA) {
        return countB - countA;
      }

      // If counts are equal, sort by most recent date (descending)
      const dateA = a._max?.date;
      const dateB = b._max?.date;

      if (!dateA && !dateB) {
        return 0;
      }
      if (!dateA) {
        return 1;
      }
      if (!dateB) {
        return -1;
      }

      return dateB.getTime() - dateA.getTime();
    });

    // Get the top result
    const topResult = sortedResults[0];
    if (!topResult) {
      return null;
    }

    return {
      accountId: topResult.accountId ?? null,
      payeeId: topResult.payeeId ?? null,
      categoryId: topResult.categoryId ?? null,
      count: topResult._count?.accountId ?? 0,
    };
  }
}
