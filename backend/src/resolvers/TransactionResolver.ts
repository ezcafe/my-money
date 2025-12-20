/**
 * Transaction Resolver
 * Handles all transaction-related GraphQL operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type {GraphQLContext} from '../middleware/context';
import {NotFoundError} from '../utils/errors';
import {z} from 'zod';
import {validate} from '../utils/validation';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {incrementAccountBalance} from '../services/AccountBalanceService';

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

export class TransactionResolver {
  /**
   * Get transactions with pagination
   */
  async transactions(
    _: unknown,
    {
      accountId,
      skip,
      take,
      first,
      orderBy,
      note,
    }: {
      accountId?: string;
      skip?: number;
      take?: number;
      first?: number;
      after?: string;
      orderBy?: {field: 'date' | 'value' | 'category' | 'account' | 'payee'; direction: 'asc' | 'desc'};
      note?: string;
    },
    context: GraphQLContext,
  ) {
    const limit = take ?? first ?? 20;
    const offset = skip ?? 0;

    const where: {
      userId: string;
      accountId?: string;
      note?: {contains: string; mode: 'insensitive'};
    } = {
      userId: context.userId,
    };

    if (accountId) {
      // Verify account belongs to user
      const account = await context.prisma.account.findFirst({
        where: {
          id: accountId,
          userId: context.userId,
        },
      });

      if (!account) {
        throw new NotFoundError('Account');
      }

      where.accountId = accountId;
    }

    // Add note filtering if provided
    if (note) {
      where.note = {
        contains: note,
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

    const [items, totalCount] = await Promise.all([
      context.prisma.transaction.findMany({
        where,
        skip: offset,
        take: limit + 1, // Fetch one extra to determine hasMore
        orderBy: prismaOrderBy,
        include: {
          account: true,
          category: true,
          payee: true,
        },
      }),
      context.prisma.transaction.count({where}),
    ]);

    const hasMore = items.length > limit;
    const transactions = hasMore ? items.slice(0, limit) : items;

    return {
      items: transactions,
      totalCount,
      hasMore,
      nextCursor: hasMore ? String(offset + limit) : null,
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
  ) {
    // Default to date descending (most recent first)
    const orderField = orderBy?.field ?? 'date';
    const orderDirection = orderBy?.direction ?? 'desc';

    // Build Prisma orderBy based on field type
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

    // Get transactions with ordering
    const transactions = await context.prisma.transaction.findMany({
      where: {userId: context.userId},
      take: limit,
      orderBy: prismaOrderBy,
      include: {
        account: true,
        category: true,
        payee: true,
      },
    });

    return transactions;
  }

  /**
   * Get transaction by ID
   */
  async transaction(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    const transaction = await context.prisma.transaction.findFirst({
      where: {
        id,
        userId: context.userId,
      },
      include: {
        account: true,
        category: true,
        payee: true,
      },
    });

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
  ) {
    // Validate input
    const validatedInput = validate(CreateTransactionInputSchema, input);

    // Verify account belongs to user
    const account = await context.prisma.account.findFirst({
      where: {
        id: validatedInput.accountId,
        userId: context.userId,
      },
    });

    if (!account) {
      throw new NotFoundError('Account');
    }

    // Verify category if provided
    if (validatedInput.categoryId) {
      const category = await context.prisma.category.findFirst({
        where: {
          id: validatedInput.categoryId,
          userId: context.userId,
        },
      });

      if (!category) {
        throw new NotFoundError('Category');
      }
    }

    // Verify payee if provided
    if (validatedInput.payeeId) {
      const payee = await context.prisma.payee.findFirst({
        where: {
          id: validatedInput.payeeId,
          userId: context.userId,
        },
      });

      if (!payee) {
        throw new NotFoundError('Payee');
      }
    }

    // Create transaction and update account balance atomically
    const transaction = await withPrismaErrorHandling(
      async () =>
        await context.prisma.$transaction(async (tx) => {
          // Create transaction
          const newTransaction = await tx.transaction.create({
            data: {
              value: validatedInput.value,
              date: validatedInput.date ?? new Date(),
              accountId: validatedInput.accountId,
              categoryId: validatedInput.categoryId,
              payeeId: validatedInput.payeeId,
              note: validatedInput.note,
              userId: context.userId,
            },
          });

          // Update account balance incrementally
          await incrementAccountBalance(validatedInput.accountId, validatedInput.value, tx);

          // Return transaction with relations
          return await tx.transaction.findUnique({
            where: {id: newTransaction.id},
            include: {
              account: true,
              category: true,
              payee: true,
            },
          });
        }),
      {resource: 'Transaction', operation: 'create'},
    );

    return transaction;
  }

  /**
   * Update transaction
   */
  async updateTransaction(
    _: unknown,
    {id, input}: {id: string; input: unknown},
    context: GraphQLContext,
  ) {
    // Validate input
    const validatedInput = validate(UpdateTransactionInputSchema, input);

    // Verify transaction belongs to user
    const existingTransaction = await context.prisma.transaction.findFirst({
      where: {
        id,
        userId: context.userId,
      },
    });

    if (!existingTransaction) {
      throw new NotFoundError('Transaction');
    }

    // Verify account if changed
    if (validatedInput.accountId) {
      const account = await context.prisma.account.findFirst({
        where: {
          id: validatedInput.accountId,
          userId: context.userId,
        },
      });

      if (!account) {
        throw new NotFoundError('Account');
      }
    }

    // Update transaction and adjust account balances atomically
    const transaction = await context.prisma.$transaction(async (tx) => {
      const oldValue = Number(existingTransaction.value);
      const oldAccountId = existingTransaction.accountId;
      const newValue = validatedInput.value !== undefined
        ? validatedInput.value
        : oldValue;
      const newAccountId = validatedInput.accountId ?? oldAccountId;

      // Update transaction
      const updatedTransaction = await tx.transaction.update({
        where: {id},
        data: {
          ...(validatedInput.value !== undefined && {value: validatedInput.value}),
          ...(validatedInput.date !== undefined && {date: validatedInput.date}),
          ...(validatedInput.accountId !== undefined && {accountId: validatedInput.accountId}),
          ...(validatedInput.categoryId !== undefined && {categoryId: validatedInput.categoryId}),
          ...(validatedInput.payeeId !== undefined && {payeeId: validatedInput.payeeId}),
          ...(validatedInput.note !== undefined && {note: validatedInput.note}),
        },
      });

      // Adjust account balances
      if (validatedInput.value !== undefined || validatedInput.accountId !== undefined) {
        if (oldAccountId === newAccountId) {
          // Same account: adjust by difference
          const delta = newValue - oldValue;
          if (delta !== 0) {
            await incrementAccountBalance(newAccountId, delta, tx);
          }
        } else {
          // Different accounts: remove from old, add to new
          await incrementAccountBalance(oldAccountId, -oldValue, tx);
          await incrementAccountBalance(newAccountId, newValue, tx);
        }
      }

      // Return transaction with relations
      return await tx.transaction.findUnique({
        where: {id: updatedTransaction.id},
        include: {
          account: true,
          category: true,
          payee: true,
        },
      });
    });

    return transaction;
  }

  /**
   * Delete transaction
   */
  async deleteTransaction(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    // Verify transaction belongs to user
    const transaction = await context.prisma.transaction.findFirst({
      where: {
        id,
        userId: context.userId,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction');
    }

    // Delete transaction and update account balance atomically
    await context.prisma.$transaction(async (tx) => {
      // Delete transaction
      await tx.transaction.delete({
        where: {id},
      });

      // Decrement account balance
      const transactionValue = Number(transaction.value);
      await incrementAccountBalance(transaction.accountId, -transactionValue, tx);
    });

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
  ) {
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Use Prisma groupBy to get values with counts
    // Note: Prisma groupBy doesn't support orderBy with _count, so we sort in JavaScript
    const results = await withPrismaErrorHandling(
      async () =>
        await context.prisma.transaction.groupBy({
          by: ['value'],
          where: {
            userId: context.userId,
            date: {
              gte: startDate,
            },
          },
          _count: {
            value: true,
          },
        }),
      {resource: 'Transaction', operation: 'topUsedValues'},
    );

    // Sort by count descending and take top 5
    const sortedResults = results
      .sort((a, b) => b._count.value - a._count.value)
      .slice(0, 5);

    // Transform results to match GraphQL schema
    // Convert Decimal to string to preserve decimal precision (.00)
    return sortedResults.map((result) => ({
      value: String(result.value),
      count: result._count.value,
    }));
  }
}


