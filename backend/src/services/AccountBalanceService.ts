/**
 * Account Balance Service
 * Handles account balance calculations and updates
 * Uses stored balance column for O(1) read performance
 */

import type {PrismaClient} from '@prisma/client';
import {prisma} from '../utils/prisma';
import {NotFoundError} from '../utils/errors';
import {invalidateAccountBalance} from '../utils/cache';
import {getContainer} from '../utils/container';
import type {AccountRepository} from '../repositories/AccountRepository';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Account Balance Service Class
 * Provides business logic methods for account balance operations
 * Uses repository pattern for data access
 */
export class AccountBalanceService {
  private readonly accountRepository: AccountRepository;
  private readonly client: PrismaTransaction | PrismaClient;

  /**
   * Constructor
   * @param prismaClient - Prisma client instance (injected dependency)
   */
  constructor(prismaClient?: PrismaTransaction | PrismaClient) {
    this.client = prismaClient ?? prisma;
    const container = getContainer();
    this.accountRepository = container.getAccountRepository(this.client);
  }

  /**
   * Get account balance from stored column
   * O(1) read performance - no aggregation needed
   * @param accountId - Account ID
   * @returns Current balance
   */
  async getAccountBalance(accountId: string): Promise<number> {
    const account = await this.accountRepository.findById(accountId, '', {balance: true});

    if (!account) {
      throw new NotFoundError('Account');
    }

    return Number(account.balance);
  }

  /**
   * Increment account balance by a delta value
   * Atomic update using database increment operation
   * @param accountId - Account ID
   * @param delta - Value to add (can be positive or negative)
   * @param tx - Optional Prisma transaction client for atomicity
   * @returns Updated balance
   */
  async incrementAccountBalance(
    accountId: string,
    delta: number,
    tx?: PrismaTransaction | PrismaClient,
  ): Promise<number> {
    const client = tx ?? this.client;
    const accountRepository = getContainer().getAccountRepository(client);
    const balance = await accountRepository.incrementBalance(accountId, delta, tx);

    // Invalidate cache after balance update (only if not in transaction)
    // If in transaction, cache will be invalidated after transaction commits
    if (!tx) {
      await invalidateAccountBalance(accountId).catch(() => {
        // Ignore cache invalidation errors
      });
    }

    return balance;
  }

  /**
   * Recalculate account balance from scratch
   * Used when initBalance changes or for data integrity verification
   * Considers category types: Income adds to balance, Expense subtracts from balance
   * @param accountId - Account ID
   * @param tx - Optional Prisma transaction client for atomicity
   * @returns Recalculated balance
   */
  async recalculateAccountBalance(
    accountId: string,
    tx?: PrismaTransaction | PrismaClient,
  ): Promise<number> {
    const client = tx ?? this.client;
    const container = getContainer();
    const accountRepository = container.getAccountRepository(client);
    const transactionRepository = container.getTransactionRepository(client);

    const account = await accountRepository.findById(accountId, '', {initBalance: true});

    if (!account) {
      throw new NotFoundError('Account');
    }

    // Get all transactions with their categories
    const transactions = await transactionRepository.findMany(
      {accountId},
      {
        include: {
          category: {
            select: {categoryType: true},
          },
        },
      },
    );

    // Calculate balance delta from all transactions
    // Income categories add money, Expense categories (or no category) subtract money
    let transactionSum = 0;
    for (const transaction of transactions) {
      const value = Number(transaction.value);
      const transactionWithCategory = transaction as typeof transaction & {
        category?: {categoryType: 'Income' | 'Expense'};
      };
      const delta = transactionWithCategory.category?.categoryType === 'Income'
        ? value
        : -value;
      transactionSum += delta;
    }

    const newBalance = Number(account.initBalance) + transactionSum;

    // Update stored balance
    await accountRepository.update(accountId, {balance: newBalance}, tx);

    // Invalidate cache after balance update (only if not in transaction)
    if (!tx) {
      await invalidateAccountBalance(accountId).catch(() => {
        // Ignore cache invalidation errors
      });
    }

    return newBalance;
  }
}

// Export singleton instance for backward compatibility
let defaultInstance: AccountBalanceService | null = null;

/**
 * Get default AccountBalanceService instance
 * @returns Default service instance
 */
export function getAccountBalanceService(): AccountBalanceService {
  defaultInstance ??= new AccountBalanceService();
  return defaultInstance;
}

// Export functions for backward compatibility (deprecated - use class instead)
/**
 * @deprecated Use AccountBalanceService class instead
 */
export async function getAccountBalance(accountId: string): Promise<number> {
  return getAccountBalanceService().getAccountBalance(accountId);
}

/**
 * @deprecated Use AccountBalanceService class instead
 */
export async function incrementAccountBalance(
  accountId: string,
  delta: number,
  tx?: PrismaTransaction | PrismaClient,
): Promise<number> {
  return getAccountBalanceService().incrementAccountBalance(accountId, delta, tx);
}

/**
 * @deprecated Use AccountBalanceService class instead
 */
export async function recalculateAccountBalance(
  accountId: string,
  tx?: PrismaTransaction | PrismaClient,
): Promise<number> {
  return getAccountBalanceService().recalculateAccountBalance(accountId, tx);
}
