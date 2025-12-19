/**
 * DataLoader utilities for batching and caching database queries
 * Prevents N+1 query problems
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-redundant-type-constituents */
import DataLoader from 'dataloader';
import {prisma} from './prisma';
import type {Account, Category, Payee, User} from '@prisma/client';

/**
 * Create a DataLoader for account balance calculations
 * Batches multiple account balance queries into efficient database aggregations
 */
export function createAccountBalanceLoader(): DataLoader<string, number> {
  return new DataLoader<string, number>(async (accountIds: readonly string[]): Promise<number[]> => {
    // Fetch accounts and their transaction sums in parallel
    const [accounts, transactionSums] = await Promise.all([
      prisma.account.findMany({
        where: {id: {in: [...accountIds]}},
      }),
      // Use groupBy to get sums for all accounts in one query
      prisma.transaction.groupBy({
        by: ['accountId'],
        where: {accountId: {in: [...accountIds]}},
        _sum: {value: true},
      }),
    ]);

    // Create maps for efficient lookup
    const accountMap = new Map<string, Account>(
      accounts.map((account) => [account.id, account]),
    );

    const sumMap = new Map<string, number>(
      transactionSums.map((sum) => [
        sum.accountId,
        sum._sum.value ? Number(sum._sum.value) : 0,
      ]),
    );

    // Calculate balance for each account
    return accountIds.map((id) => {
      const account = accountMap.get(id);
      if (!account) {
        return 0;
      }
      const transactionSum = sumMap.get(id) ?? 0;
      return Number(account.initBalance) + transactionSum;
    });
  });
}

/**
 * Create a DataLoader for category lookups
 */
export function createCategoryLoader(): DataLoader<string, Category | null> {
  return new DataLoader<string, Category | null>(
    async (categoryIds: readonly string[]): Promise<Array<Category | null>> => {
      const categories = await prisma.category.findMany({
        where: {id: {in: [...categoryIds]}},
      });

      const categoryMap = new Map<string, Category>(
        categories.map((cat) => [cat.id, cat]),
      );
      return categoryIds.map((id) => categoryMap.get(id) ?? null);
    },
  );
}

/**
 * Create a DataLoader for payee lookups
 */
export function createPayeeLoader(): DataLoader<string, Payee | null> {
  return new DataLoader<string, Payee | null>(
    async (payeeIds: readonly string[]): Promise<Array<Payee | null>> => {
      const payees = await prisma.payee.findMany({
        where: {id: {in: [...payeeIds]}},
      });

      const payeeMap = new Map<string, Payee>(
        payees.map((payee) => [payee.id, payee]),
      );
      return payeeIds.map((id) => payeeMap.get(id) ?? null);
    },
  );
}

/**
 * Create a DataLoader for account lookups
 */
export function createAccountLoader(): DataLoader<string, Account | null> {
  return new DataLoader<string, Account | null>(
    async (accountIds: readonly string[]): Promise<Array<Account | null>> => {
      const accounts = await prisma.account.findMany({
        where: {id: {in: [...accountIds]}},
      });

      const accountMap = new Map<string, Account>(
        accounts.map((acc) => [acc.id, acc]),
      );
      return accountIds.map((id) => accountMap.get(id) ?? null);
    },
  );
}

/**
 * Create a DataLoader for user lookups
 */
export function createUserLoader(): DataLoader<string, User | null> {
  return new DataLoader<string, User | null>(
    async (userIds: readonly string[]): Promise<Array<User | null>> => {
      const users = await prisma.user.findMany({
        where: {id: {in: [...userIds]}},
      });

      const userMap = new Map<string, User>(
        users.map((user) => [user.id, user]),
      );
      return userIds.map((id) => userMap.get(id) ?? null);
    },
  );
}

/**
 * DataLoader context interface
 */
export interface DataLoaderContext {
  accountBalanceLoader: ReturnType<typeof createAccountBalanceLoader>;
  categoryLoader: ReturnType<typeof createCategoryLoader>;
  payeeLoader: ReturnType<typeof createPayeeLoader>;
  accountLoader: ReturnType<typeof createAccountLoader>;
  userLoader: ReturnType<typeof createUserLoader>;
}

/**
 * Create all DataLoaders for a request context
 */
export function createDataLoaders(): DataLoaderContext {
  return {
    accountBalanceLoader: createAccountBalanceLoader(),
    categoryLoader: createCategoryLoader(),
    payeeLoader: createPayeeLoader(),
    accountLoader: createAccountLoader(),
    userLoader: createUserLoader(),
  };
}

