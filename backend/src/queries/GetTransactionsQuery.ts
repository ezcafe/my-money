/**
 * Get Transactions Query
 * CQRS query handler for fetching transactions
 */

import type { GraphQLContext } from '../middleware/context';
import type { Transaction } from '@prisma/client';
import { buildOrderBy } from '../utils/queryBuilder';
import { getUserDefaultWorkspace } from '../services/WorkspaceService';
import { checkWorkspaceAccess } from '../services/WorkspaceService';
import { NotFoundError } from '../utils/errors';
import * as postgresCache from '../utils/postgresCache';
import { transactionQueryKey, hashFilters } from '../utils/cacheKeys';
import { CACHE_TAGS } from '../utils/cacheTags';
import { getContainer } from '../utils/container';

/**
 * Get transactions query input
 */
export interface GetTransactionsQueryInput {
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
}

/**
 * Get transactions query handler
 */
export async function handleGetTransactions(
  input: GetTransactionsQueryInput,
  context: GraphQLContext
): Promise<{
  items: Transaction[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
}> {
  // Cursor-based pagination (offset-based for compatibility)
  let limit = input.first ?? input.last ?? 20;
  let offset = 0;

  // Parse cursor
  if (input.after) {
    try {
      const cursorData = JSON.parse(
        Buffer.from(input.after, 'base64').toString('utf-8')
      ) as { offset: number; orderBy?: string };
      offset = cursorData.offset ?? 0;
      if (cursorData.orderBy && input.orderBy) {
        const cursorOrderBy = `${input.orderBy.field}:${input.orderBy.direction}`;
        if (cursorData.orderBy !== cursorOrderBy) {
          offset = 0;
        }
      }
    } catch {
      try {
        offset = Number.parseInt(
          Buffer.from(input.after, 'base64').toString('utf-8'),
          10
        );
      } catch {
        offset = 0;
      }
    }
  } else if (input.before) {
    try {
      const cursorData = JSON.parse(
        Buffer.from(input.before, 'base64').toString('utf-8')
      ) as { offset: number; orderBy?: string };
      const beforeOffset = cursorData.offset ?? 0;
      offset = Math.max(0, beforeOffset - (input.last ?? 20));
    } catch {
      try {
        const beforeOffset = Number.parseInt(
          Buffer.from(input.before, 'base64').toString('utf-8'),
          10
        );
        offset = Math.max(0, beforeOffset - (input.last ?? 20));
      } catch {
        offset = 0;
      }
    }
  }

  const workspaceId =
    context.currentWorkspaceId ??
    (await getUserDefaultWorkspace(context.userId));
  await checkWorkspaceAccess(workspaceId, context.userId);

  const MAX_PAGE_SIZE = 100;
  limit = Math.min(limit, MAX_PAGE_SIZE);

  const container = getContainer();
  const transactionRepository = container.getTransactionRepository(
    context.prisma
  );
  const accountRepository = container.getAccountRepository(context.prisma);

  const where: {
    account: { workspaceId: string };
    accountId?: string;
    categoryId?: string | null;
    payeeId?: string | null;
    note?: { contains: string; mode: 'insensitive' };
  } = {
    account: { workspaceId },
  };

  if (input.accountId) {
    const account = await accountRepository.findById(
      input.accountId,
      workspaceId,
      { id: true }
    );
    if (!account) {
      throw new NotFoundError('Account');
    }
    where.accountId = input.accountId;
  }

  if (input.categoryId) {
    where.categoryId = input.categoryId;
  }

  if (input.payeeId) {
    where.payeeId = input.payeeId;
  }

  if (input.note) {
    where.note = { contains: input.note, mode: 'insensitive' };
  }

  // Build cache key
  const filters = {
    accountId: input.accountId,
    categoryId: input.categoryId,
    payeeId: input.payeeId,
    note: input.note,
    orderBy: input.orderBy,
  };
  const cacheKey = transactionQueryKey(workspaceId, hashFilters(filters));

  // Try cache first
  const cached = await postgresCache.get<{
    items: Transaction[];
    totalCount: number;
  }>(cacheKey);
  if (cached) {
    const hasMore = offset + limit < cached.totalCount;
    const nextCursor = hasMore
      ? Buffer.from(
          JSON.stringify({
            offset: offset + limit,
            orderBy: input.orderBy
              ? `${input.orderBy.field}:${input.orderBy.direction}`
              : undefined,
          }),
          'utf-8'
        ).toString('base64')
      : null;
    return {
      items: cached.items.slice(offset, offset + limit),
      totalCount: cached.totalCount,
      hasMore,
      nextCursor,
    };
  }

  // Fetch from database
  const orderBy = buildOrderBy(input.orderBy);
  const [items, totalCount] = await Promise.all([
    transactionRepository.findMany(where, {
      skip: offset,
      take: limit,
      orderBy,
    }),
    transactionRepository.count(where),
  ]);

  // Cache results
  const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
  const cacheTags = [
    CACHE_TAGS.TRANSACTIONS(workspaceId),
    CACHE_TAGS.TRANSACTION_QUERIES(workspaceId),
  ];
  void postgresCache
    .set(cacheKey, { items, totalCount }, CACHE_TTL_MS, cacheTags)
    .catch(() => {
      // Ignore cache errors
    });

  const hasMore = offset + limit < totalCount;
  const nextCursor = hasMore
    ? Buffer.from(
        JSON.stringify({
          offset: offset + limit,
          orderBy: input.orderBy
            ? `${input.orderBy.field}:${input.orderBy.direction}`
            : undefined,
        })
      ).toString('base64')
    : null;

  return {
    items,
    totalCount,
    hasMore,
    nextCursor,
  };
}
