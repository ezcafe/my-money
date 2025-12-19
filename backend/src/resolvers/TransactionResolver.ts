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
    }: {
      accountId?: string;
      skip?: number;
      take?: number;
      first?: number;
      after?: string;
    },
    context: GraphQLContext,
  ) {
    const limit = take ?? first ?? 20;
    const offset = skip ?? 0;

    const where: {
      userId: string;
      accountId?: string;
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

    const [items, totalCount] = await Promise.all([
      context.prisma.transaction.findMany({
        where,
        skip: offset,
        take: limit + 1, // Fetch one extra to determine hasMore
        orderBy: {date: 'desc'},
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
   */
  async recentTransactions(
    _: unknown,
    {limit = 30}: {limit?: number},
    context: GraphQLContext,
  ) {
    const transactions = await context.prisma.transaction.findMany({
      where: {userId: context.userId},
      take: limit,
      orderBy: {date: 'desc'},
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

    // Create transaction
    const transaction = await withPrismaErrorHandling(
      async () =>
        await context.prisma.transaction.create({
          data: {
            value: validatedInput.value,
            date: validatedInput.date ?? new Date(),
            accountId: validatedInput.accountId,
            categoryId: validatedInput.categoryId,
            payeeId: validatedInput.payeeId,
            note: validatedInput.note,
            userId: context.userId,
          },
          include: {
            account: true,
            category: true,
            payee: true,
          },
        }),
      {resource: 'Transaction', operation: 'create'},
    );

    // Account balance is automatically calculated from initBalance + sum of transactions
    // No need to explicitly update it here, but we could trigger a recalculation if needed

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

    const transaction = await context.prisma.transaction.update({
      where: {id},
      data: {
        ...(validatedInput.value !== undefined && {value: validatedInput.value}),
        ...(validatedInput.date !== undefined && {date: validatedInput.date}),
        ...(validatedInput.accountId !== undefined && {accountId: validatedInput.accountId}),
        ...(validatedInput.categoryId !== undefined && {categoryId: validatedInput.categoryId}),
        ...(validatedInput.payeeId !== undefined && {payeeId: validatedInput.payeeId}),
        ...(validatedInput.note !== undefined && {note: validatedInput.note}),
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

    await context.prisma.transaction.delete({
      where: {id},
    });

    return true;
  }
}


