/**
 * Account Resolver
 * Handles all account-related GraphQL operations
 */

 
import type {GraphQLContext} from '../middleware/context';
import {NotFoundError, ForbiddenError} from '../utils/errors';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {recalculateAccountBalance} from '../services/AccountBalanceService';
import {AccountService} from '../services/AccountService';
import {sanitizeUserInput} from '../utils/sanitization';
import {BaseResolver} from './BaseResolver';

export class AccountResolver extends BaseResolver {
  /**
   * Get account service instance with context
   * @param context - GraphQL context
   * @returns Account service instance
   */
  private getAccountService(context: GraphQLContext): AccountService {
    return new AccountService(context.prisma);
  }

  /**
   * Get all accounts for the current user
   * Reads balance directly from stored column for O(1) performance
   * Ensures a default account exists before returning results
   */
  async accounts(_: unknown, __: unknown, context: GraphQLContext) {
    // Ensure a default account exists
    const accountService = this.getAccountService(context);
    await accountService.ensureDefaultAccount(context.userId);

    const accounts = await context.prisma.account.findMany({
      where: {userId: context.userId},
      orderBy: {createdAt: 'desc'},
    });

    // Return accounts with balance from stored column
    return accounts.map((account) => ({
      ...account,
      initBalance: Number(account.initBalance),
      balance: Number(account.balance),
    }));
  }

  /**
   * Get account by ID
   * Reads balance directly from stored column for O(1) performance
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

    return {
      ...account,
      initBalance: Number(account.initBalance),
      balance: Number(account.balance),
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
      select: {id: true},
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
    const initBalance = input.initBalance ?? 0;
    const account = await withPrismaErrorHandling(
      async () =>
        await context.prisma.account.create({
          data: {
            name: sanitizeUserInput(input.name),
            initBalance,
            balance: initBalance, // New account has no transactions, balance equals initBalance
            userId: context.userId,
          },
        }),
      {resource: 'Account', operation: 'create'},
    );

    return {
      ...account,
      initBalance: Number(account.initBalance),
      balance: Number(account.balance),
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
      select: {id: true},
    });

    if (!existingAccount) {
      throw new NotFoundError('Account');
    }

    // Update account and recalculate balance if initBalance changed
    const account = await context.prisma.$transaction(async (tx) => {
      const updatedAccount = await tx.account.update({
        where: {id},
        data: {
          ...(input.name !== undefined && {name: sanitizeUserInput(input.name)}),
          ...(input.initBalance !== undefined && {initBalance: input.initBalance}),
        },
      });

      // If initBalance changed, recalculate balance
      if (input.initBalance !== undefined) {
        await recalculateAccountBalance(id, tx);
      }

      return updatedAccount;
    });

    // Fetch updated account with balance
    const accountWithBalance = await context.prisma.account.findUnique({
      where: {id: account.id},
    });

    return {
      ...accountWithBalance,
      initBalance: Number(accountWithBalance!.initBalance),
      balance: Number(accountWithBalance!.balance),
    };
  }

  /**
   * Delete account (cannot delete default account)
   */
  async deleteAccount(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    // Verify account belongs to user
    const account = await this.requireEntityOwnership<{id: string; isDefault: boolean}>(
      context.prisma,
      'account',
      id,
      context.userId,
      {id: true, isDefault: true},
    );

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


