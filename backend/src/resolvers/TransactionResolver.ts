/**
 * Transaction Resolver
 * Handles all transaction-related GraphQL operations
 */


import type {GraphQLContext} from '../middleware/context';
import type {Transaction} from '@prisma/client';
import {NotFoundError} from '../utils/errors';
import {z} from 'zod';
import {validate} from '../utils/validation';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {incrementAccountBalance} from '../services/AccountBalanceService';
import {createTransaction, updateTransactionWithBalance} from '../services/TransactionService';
import {updateBudgetForTransaction} from '../services/BudgetService';
import {TransactionRepository} from '../repositories/TransactionRepository';
import {CategoryRepository} from '../repositories/CategoryRepository';
import {PayeeRepository} from '../repositories/PayeeRepository';
import {AccountRepository} from '../repositories/AccountRepository';
import {buildOrderBy} from '../utils/queryBuilder';
import {BaseResolver} from './BaseResolver';
import * as postgresCache from '../utils/postgresCache';
import {transactionQueryKey, hashFilters} from '../utils/cacheKeys';
import {invalidateAccountBalance} from '../utils/cache';

const CreateTransactionInputSchema = z.object({
  value: z.number().finite(),
  date: z.date().optional(),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  payeeId: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
});

const UpdateTransactionInputSchema = z.object({
  value: z.number().finite().optional(),
  date: z.date().optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  payeeId: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
});

export class TransactionResolver extends BaseResolver {
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
      orderBy?: {field: 'date' | 'value' | 'category' | 'account' | 'payee'; direction: 'asc' | 'desc'};
      note?: string;
    },
    context: GraphQLContext,
  ): Promise<{items: Transaction[]; totalCount: number; hasMore: boolean; nextCursor: string | null}> {
    // Cursor-based pagination
    let limit = first ?? last ?? 20;
    let offset = 0;

    // Parse cursor (base64 encoded offset)
    if (after) {
      try {
        offset = Number.parseInt(Buffer.from(after, 'base64').toString('utf-8'), 10);
      } catch {
        offset = 0;
      }
    } else if (before) {
      try {
        const beforeOffset = Number.parseInt(Buffer.from(before, 'base64').toString('utf-8'), 10);
        offset = Math.max(0, beforeOffset - (last ?? 20));
      } catch {
        offset = 0;
      }
    }

    // Enforce maximum page size
    const MAX_PAGE_SIZE = 100;
    limit = Math.min(limit, MAX_PAGE_SIZE);
    const transactionRepository = new TransactionRepository(context.prisma);
    const categoryRepository = new CategoryRepository(context.prisma);
    const payeeRepository = new PayeeRepository(context.prisma);

    const where: {
      userId: string;
      accountId?: string;
      categoryId?: string | null;
      payeeId?: string | null;
      note?: {contains: string; mode: 'insensitive'};
    } = {
      userId: context.userId,
    };

    if (accountId) {
      // userId in where clause already prevents unauthorized access
      // No need for separate verification query
      where.accountId = accountId;
    }

    if (categoryId) {
      // Verify category exists and is accessible to user (user-specific or default)
      const category = await categoryRepository.findById(categoryId, context.userId, {id: true});

      if (!category) {
        throw new NotFoundError('Category');
      }

      where.categoryId = categoryId;
    }

    if (payeeId) {
      // Verify payee exists and is accessible to user (user-specific or default)
      const payee = await payeeRepository.findById(payeeId, context.userId, {id: true});

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
      void postgresCache.set(cacheKey, totalCount, TRANSACTION_QUERY_CACHE_TTL_MS).catch(() => {
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

    // Generate cursor for next page (base64 encoded offset)
    const nextCursor = hasMore
      ? Buffer.from(String(offset + limit), 'utf-8').toString('base64')
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
      orderBy?: {field: 'date' | 'value' | 'category' | 'account' | 'payee'; direction: 'asc' | 'desc'};
    },
    context: GraphQLContext,
  ): Promise<Transaction[]> {
    // Build Prisma orderBy based on field type
    const prismaOrderBy = buildOrderBy(orderBy);

    const transactionRepository = new TransactionRepository(context.prisma);

    // Get transactions with ordering
    // Relations are loaded via DataLoaders in GraphQL field resolvers
    // This prevents N+1 query problems and reduces memory usage
    const transactions = await transactionRepository.findMany(
      {userId: context.userId},
      {
        take: limit,
        orderBy: prismaOrderBy,
      },
    );

    return transactions;
  }

  /**
   * Get transaction by ID
   */
  async transaction(_: unknown, {id}: {id: string}, context: GraphQLContext): Promise<Transaction | null> {
    const transactionRepository = new TransactionRepository(context.prisma);
    const transaction = await transactionRepository.findById(
      id,
      context.userId,
      undefined,
      {
        account: true,
        category: true,
        payee: true,
      },
    );

    return transaction;
  }

  /**
   * Create a transaction
   * This is called when Add button is clicked in calculator
   * The value can be positive or negative
   */
  async createTransaction(
    _: unknown,
    {input}: {input: unknown},
    context: GraphQLContext,
  ): Promise<Transaction> {
    // Validate input
    const validatedInput = validate(CreateTransactionInputSchema, input);

    // Use service layer for business logic
    const transaction = await withPrismaErrorHandling(
      async () => {
        return await context.prisma.$transaction(async (tx) => {
          return await createTransaction(validatedInput, context.userId, tx);
        });
      },
      {resource: 'Transaction', operation: 'create'},
    );

    return transaction as unknown as Transaction;
  }

  /**
   * Update transaction
   */
  async updateTransaction(
    _: unknown,
    {id, input}: {id: string; input: unknown},
    context: GraphQLContext,
  ): Promise<Transaction> {
    // Validate input
    const validatedInput = validate(UpdateTransactionInputSchema, input);

    const transactionRepository = new TransactionRepository(context.prisma);
    const categoryRepository = new CategoryRepository(context.prisma);
    const accountRepository = new AccountRepository(context.prisma);

    // Verify transaction belongs to user and fetch with category
    const existingTransactionRaw = await transactionRepository.findById(
      id,
      context.userId,
      undefined,
      {
        category: true,
      },
    );

    if (!existingTransactionRaw) {
      throw new NotFoundError('Transaction');
    }

    // Type assertion for transaction with category relation
    const existingTransaction = existingTransactionRaw as typeof existingTransactionRaw & {
      category: {categoryType: 'Income' | 'Expense'} | null;
    };

    // Verify account if changed
    if (validatedInput.accountId) {
      const account = await accountRepository.findById(validatedInput.accountId, context.userId, {id: true});

      if (!account) {
        throw new NotFoundError('Account');
      }
    }

    // Verify and fetch new category if changed
    let newCategory: {categoryType: 'Income' | 'Expense'} | null = null;
    if (validatedInput.categoryId !== undefined) {
      if (validatedInput.categoryId) {
        const foundCategory = await categoryRepository.findById(
          validatedInput.categoryId,
          context.userId,
          {id: true, categoryType: true},
        );

        if (!foundCategory) {
          throw new NotFoundError('Category');
        }

        newCategory = foundCategory;
      }
    } else {
      // Category not changed, use existing
      newCategory = existingTransaction.category;
    }

    // Use service layer for complex business logic
    const transaction = await context.prisma.$transaction(async (tx) => {
      return await updateTransactionWithBalance(
        id,
        validatedInput,
        {
          value: Number(existingTransaction.value),
          accountId: existingTransaction.accountId,
          categoryId: existingTransaction.categoryId,
          category: existingTransaction.category,
          date: existingTransaction.date,
        },
        newCategory,
        context.userId,
        tx,
      );
    });

    return transaction as unknown as Transaction;
  }

  /**
   * Delete transaction
   */
  async deleteTransaction(_: unknown, {id}: {id: string}, context: GraphQLContext): Promise<boolean> {
    const transactionRepository = new TransactionRepository(context.prisma);

    // Verify transaction belongs to user and fetch with category
    const transactionRaw = await transactionRepository.findById(
      id,
      context.userId,
      undefined,
      {
        category: true,
      },
    );

    if (!transactionRaw) {
      throw new NotFoundError('Transaction');
    }

    // Type assertion for transaction with category relation
    const transaction = transactionRaw as typeof transactionRaw & {
      category: {categoryType: 'Income' | 'Expense'} | null;
    };

    // Calculate balance delta to reverse based on category type
    const transactionValue = Number(transaction.value);
    const balanceDelta = transaction.category?.categoryType === 'Income'
      ? -transactionValue  // Reverse income: subtract
      : transactionValue;  // Reverse expense: add back

    // Delete transaction and update account balance atomically
    await context.prisma.$transaction(async (tx) => {
      const txTransactionRepository = new TransactionRepository(tx);

      // Update budgets before deleting (need transaction data)
      await updateBudgetForTransaction(
        {
          id: transaction.id,
          accountId: transaction.accountId,
          categoryId: transaction.categoryId,
          payeeId: transaction.payeeId,
          userId: transaction.userId,
          value: Number(transaction.value),
          date: transaction.date,
          categoryType: transaction.category?.categoryType ?? null,
        },
        'delete',
        undefined,
        tx,
      );

      // Delete transaction
      await txTransactionRepository.delete(id, tx);

      // Reverse the balance change
      await incrementAccountBalance(transaction.accountId, balanceDelta, tx);
    });

    // Invalidate caches after transaction deletion
    await Promise.all([
      invalidateAccountBalance(transaction.accountId).catch(() => {}),
      postgresCache.invalidateUserCache(context.userId).catch(() => {}),
    ]);

    return true;
  }

  /**
   * Get top 5 most used transaction values from recent transactions
   * @param days - Number of days to look back (default: 90)
   * @returns Array of top used values with their counts
   */
  async topUsedValues(
    _: unknown,
    {days = 90}: {days?: number},
    context: GraphQLContext,
  ): Promise<Array<{value: string; count: number}>> {
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactionRepository = new TransactionRepository(context.prisma);

    // Use Prisma groupBy to get values with counts
    // Note: Prisma groupBy doesn't support orderBy with _count, so we sort in JavaScript
    const results = await withPrismaErrorHandling(
      async () =>
        await transactionRepository.groupBy(
          ['value'],
          {
            userId: context.userId,
            date: {
              gte: startDate,
            },
          },
          {
            _count: {
              value: true,
            },
          },
        ),
      {resource: 'Transaction', operation: 'topUsedValues'},
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
    {amount, days = 90}: {amount: number; days?: number},
    context: GraphQLContext,
  ): Promise<{accountId: string | null; payeeId: string | null; categoryId: string | null; count: number} | null> {
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactionRepository = new TransactionRepository(context.prisma);

    // Use Prisma groupBy to get combinations with counts
    // Group by accountId, payeeId, categoryId to find most common combination
    const results = await withPrismaErrorHandling(
      async () =>
        await transactionRepository.groupBy(
          ['accountId', 'payeeId', 'categoryId'],
          {
            userId: context.userId,
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
          },
        ),
      {resource: 'Transaction', operation: 'mostUsedTransactionDetails'},
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


