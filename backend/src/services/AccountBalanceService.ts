/**
 * Account Balance Service
 * Handles account balance calculations and updates
 * Uses stored balance column for O(1) read performance
 */


import type {PrismaClient} from '@prisma/client';
import {prisma} from '../utils/prisma';
import {AccountRepository} from '../repositories/AccountRepository';
import {TransactionRepository} from '../repositories/TransactionRepository';
import {NotFoundError} from '../utils/errors';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Get account balance from stored column
 * O(1) read performance - no aggregation needed
 * @param accountId - Account ID
 * @returns Current balance
 */
export async function getAccountBalance(accountId: string): Promise<number> {
  const accountRepository = new AccountRepository(prisma);
  const account = await accountRepository.findById(accountId, '', {balance: true});

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
export async function incrementAccountBalance(
  accountId: string,
  delta: number,
  tx?: PrismaTransaction | PrismaClient,
): Promise<number> {
  const client = tx ?? prisma;
  const accountRepository = new AccountRepository(client);
  return accountRepository.incrementBalance(accountId, delta, tx);
}

/**
 * Recalculate account balance from scratch
 * Used when initBalance changes or for data integrity verification
 * Considers category types: Income adds to balance, Expense subtracts from balance
 * @param accountId - Account ID
 * @param tx - Optional Prisma transaction client for atomicity
 * @returns Recalculated balance
 */
export async function recalculateAccountBalance(
  accountId: string,
  tx?: PrismaTransaction | PrismaClient,
): Promise<number> {
  const client = tx ?? prisma;
  const accountRepository = new AccountRepository(client);
  const transactionRepository = new TransactionRepository(client);

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
          select: {type: true},
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
      category?: {type: 'INCOME' | 'EXPENSE'};
    };
    const delta = transactionWithCategory.category?.type === 'INCOME'
      ? value
      : -value;
    transactionSum += delta;
  }

  const newBalance = Number(account.initBalance) + transactionSum;

  // Update stored balance
  await accountRepository.update(accountId, {balance: newBalance}, tx);

  return newBalance;
}



