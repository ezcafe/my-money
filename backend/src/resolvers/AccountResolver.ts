/**
 * Account Resolver
 * Handles all account-related GraphQL operations
 */


import type {GraphQLContext} from '../middleware/context';
import type {Account} from '@prisma/client';
import {NotFoundError, ForbiddenError} from '../utils/errors';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {recalculateAccountBalance} from '../services/AccountBalanceService';
import {AccountService} from '../services/AccountService';
import {AccountRepository} from '../repositories/AccountRepository';
import {sanitizeUserInput} from '../utils/sanitization';
import {BaseResolver} from './BaseResolver';
import {balanceCache} from '../utils/cache';

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
  async accounts(_: unknown, __: unknown, context: GraphQLContext): Promise<Array<Account & {initBalance: number; balance: number}>> {
    // Ensure a default account exists
    const accountService = this.getAccountService(context);
    await accountService.ensureDefaultAccount(context.userId);

    const accountRepository = new AccountRepository(context.prisma);
    const accounts = await accountRepository.findMany(context.userId);

    // Sort by createdAt descending
    accounts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Return accounts with balance from stored column
    return accounts.map((account) => ({
      ...account,
      initBalance: Number(account.initBalance),
      balance: Number(account.balance),
    })) as Array<Account & {initBalance: number; balance: number}>;
  }

  /**
   * Get account by ID
   * Reads balance directly from stored column for O(1) performance
   */
  async account(_: unknown, {id}: {id: string}, context: GraphQLContext): Promise<(Account & {initBalance: number; balance: number}) | null> {
    const accountRepository = new AccountRepository(context.prisma);
    const account = await accountRepository.findById(id, context.userId);

    if (!account) {
      return null;
    }

    return {
      ...account,
      initBalance: Number(account.initBalance),
      balance: Number(account.balance),
    } as Account & {initBalance: number; balance: number};
  }

  /**
   * Get account balance
   * Uses field-level caching to reduce database queries
   */
  async accountBalance(_: unknown, {accountId}: {accountId: string}, context: GraphQLContext): Promise<number> {
    // Check cache first
    const cached = balanceCache.get(accountId);
    if (cached !== undefined) {
      return cached;
    }

    // Verify account belongs to user
    const accountRepository = new AccountRepository(context.prisma);
    const account = await accountRepository.findById(accountId, context.userId, {id: true});

    if (!account) {
      throw new NotFoundError('Account');
    }

    // Use DataLoader for efficient balance calculation
    const balance = await context.accountBalanceLoader.load(accountId);

    // Cache the result
    balanceCache.set(accountId, balance);

    return balance;
  }

  /**
   * Create a new account
   */
  async createAccount(
    _: unknown,
    {input}: {input: {name: string; initBalance?: number}},
    context: GraphQLContext,
  ): Promise<Account & {initBalance: number; balance: number}> {
    const initBalance = input.initBalance ?? 0;
    const accountRepository = new AccountRepository(context.prisma);
    const account = await withPrismaErrorHandling(
      async () =>
        await accountRepository.create({
          name: sanitizeUserInput(input.name),
          initBalance,
          balance: initBalance, // New account has no transactions, balance equals initBalance
          userId: context.userId,
        }),
      {resource: 'Account', operation: 'create'},
    );

    return {
      ...account,
      initBalance: Number(account.initBalance),
      balance: Number(account.balance),
    } as Account & {initBalance: number; balance: number};
  }

  /**
   * Update account
   */
  async updateAccount(
    _: unknown,
    {id, input}: {id: string; input: {name?: string; initBalance?: number}},
    context: GraphQLContext,
  ): Promise<Account & {initBalance: number; balance: number}> {
    // Verify account belongs to user
    const accountRepository = new AccountRepository(context.prisma);
    const existingAccount = await accountRepository.findById(id, context.userId, {id: true});

    if (!existingAccount) {
      throw new NotFoundError('Account');
    }

    // Update account and recalculate balance if initBalance changed
    await context.prisma.$transaction(async (tx) => {
      const txAccountRepository = new AccountRepository(tx);
      await txAccountRepository.update(id, {
        ...(input.name !== undefined && {name: sanitizeUserInput(input.name)}),
        ...(input.initBalance !== undefined && {initBalance: input.initBalance}),
      });

      // If initBalance changed, recalculate balance
      if (input.initBalance !== undefined) {
        await recalculateAccountBalance(id, tx);
      }
    });

    // Fetch updated account with balance
    const accountWithBalance = await accountRepository.findById(id, context.userId);

    return {
      ...accountWithBalance,
      initBalance: Number(accountWithBalance!.initBalance),
      balance: Number(accountWithBalance!.balance),
    } as Account & {initBalance: number; balance: number};
  }

  /**
   * Delete account (cannot delete default account)
   */
  async deleteAccount(_: unknown, {id}: {id: string}, context: GraphQLContext): Promise<boolean> {
    // Verify account belongs to user
    const accountRepository = new AccountRepository(context.prisma);
    const account = await accountRepository.findById(id, context.userId, {id: true, isDefault: true});

    if (!account) {
      throw new NotFoundError('Account');
    }

    // Cannot delete default account
    if (account.isDefault) {
      throw new ForbiddenError('Cannot delete default account');
    }

    await accountRepository.delete(id);

    return true;
  }
}


