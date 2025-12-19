/**
 * Account Resolver
 * Handles all account-related GraphQL operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type {GraphQLContext} from '../middleware/context';
import {NotFoundError, ForbiddenError} from '../utils/errors';
import {withPrismaErrorHandling} from '../utils/prismaErrors';

export class AccountResolver {
  /**
   * Get all accounts for the current user
   * Optimized to calculate balances using database aggregation
   */
  async accounts(_: unknown, __: unknown, context: GraphQLContext) {
    const accounts = await context.prisma.account.findMany({
      where: {userId: context.userId},
      orderBy: {createdAt: 'desc'},
    });

    // Calculate balance for each account using database aggregation
    const accountsWithBalance = await Promise.all(
      accounts.map(async (account) => {
        const balanceResult = await context.prisma.transaction.aggregate({
          where: {accountId: account.id},
          _sum: {value: true},
        });

        const transactionSum = balanceResult._sum.value
          ? Number(balanceResult._sum.value)
          : 0;
        const balance = Number(account.initBalance) + transactionSum;

        return {
          ...account,
          balance,
        };
      }),
    );

    return accountsWithBalance;
  }

  /**
   * Get account by ID
   * Optimized to calculate balance using database aggregation
   */
  async account(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    const account = await context.prisma.account.findFirst({
      where: {
        id,
        userId: context.userId,
      },
    });

    if (!account) {
      return null;
    }

    // Calculate balance using database aggregation
    const balanceResult = await context.prisma.transaction.aggregate({
      where: {accountId: account.id},
      _sum: {value: true},
    });

    const transactionSum = balanceResult._sum.value
      ? Number(balanceResult._sum.value)
      : 0;
    const balance = Number(account.initBalance) + transactionSum;

    return {
      ...account,
      balance,
    };
  }

  /**
   * Get account balance
   */
  async accountBalance(_: unknown, {accountId}: {accountId: string}, context: GraphQLContext) {
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

    // Use DataLoader for efficient balance calculation
    return context.accountBalanceLoader.load(accountId);
  }

  /**
   * Create a new account
   */
  async createAccount(
    _: unknown,
    {input}: {input: {name: string; initBalance?: number}},
    context: GraphQLContext,
  ) {
    const account = await withPrismaErrorHandling(
      async () =>
        await context.prisma.account.create({
          data: {
            name: input.name,
            initBalance: input.initBalance ?? 0,
            userId: context.userId,
          },
        }),
      {resource: 'Account', operation: 'create'},
    );

    // New account has no transactions, balance equals initBalance
    const balance = Number(account.initBalance);
    return {
      ...account,
      balance,
    };
  }

  /**
   * Update account
   */
  async updateAccount(
    _: unknown,
    {id, input}: {id: string; input: {name?: string; initBalance?: number}},
    context: GraphQLContext,
  ) {
    // Verify account belongs to user
    const existingAccount = await context.prisma.account.findFirst({
      where: {
        id,
        userId: context.userId,
      },
    });

    if (!existingAccount) {
      throw new NotFoundError('Account');
    }

    const account = await context.prisma.account.update({
      where: {id},
      data: {
        ...(input.name !== undefined && {name: input.name}),
        ...(input.initBalance !== undefined && {initBalance: input.initBalance}),
      },
    });

    // Calculate balance using database aggregation
    const balanceResult = await context.prisma.transaction.aggregate({
      where: {accountId: account.id},
      _sum: {value: true},
    });

    const transactionSum = balanceResult._sum.value
      ? Number(balanceResult._sum.value)
      : 0;
    const balance = Number(account.initBalance) + transactionSum;

    return {
      ...account,
      balance,
    };
  }

  /**
   * Delete account (cannot delete default account)
   */
  async deleteAccount(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    // Verify account belongs to user
    const account = await context.prisma.account.findFirst({
      where: {
        id,
        userId: context.userId,
      },
    });

    if (!account) {
      throw new NotFoundError('Account');
    }

    // Cannot delete default account
    if (account.isDefault) {
      throw new ForbiddenError('Cannot delete default account');
    }

    await context.prisma.account.delete({
      where: {id},
    });

    return true;
  }
}


