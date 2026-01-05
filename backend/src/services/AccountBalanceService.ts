/**
 * Account Balance Service
 * Handles account balance calculations and updates
 * Uses stored balance column for O(1) read performance
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import type {PrismaClient} from '@prisma/client';
import {prisma} from '../utils/prisma';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Get account balance from stored column
 * O(1) read performance - no aggregation needed
 * @param accountId - Account ID
 * @returns Current balance
 */
export async function getAccountBalance(accountId: string): Promise<number> {
  const account = await prisma.account.findUnique({
    where: {id: accountId},
    select: {balance: true},
  });

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
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

  const account = await client.account.update({
    where: {id: accountId},
    data: {
      balance: {
        increment: delta,
      },
    },
    select: {balance: true},
  });

  return Number(account.balance);
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

  const account = await client.account.findUnique({
    where: {id: accountId},
    select: {initBalance: true},
  });

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  // Get all transactions with their categories
  const transactions = await client.transaction.findMany({
    where: {accountId},
    include: {
      category: {
        select: {type: true},
      },
    },
  });

  // Calculate balance delta from all transactions
  // Income categories add money, Expense categories (or no category) subtract money
  let transactionSum = 0;
  for (const transaction of transactions) {
    const value = Number(transaction.value);
    const delta = transaction.category?.type === 'INCOME'
      ? value
      : -value;
    transactionSum += delta;
  }

  const newBalance = Number(account.initBalance) + transactionSum;

  // Update stored balance
  await client.account.update({
    where: {id: accountId},
    data: {balance: newBalance},
  });

  return newBalance;
}

/**
 * Calculate account balance from initial balance and all transactions
 * Legacy function - kept for backward compatibility
 * Prefer using getAccountBalance() for better performance
 * @param accountId - Account ID
 * @returns Current balance
 * @deprecated Use getAccountBalance() instead for O(1) performance
 */
export async function calculateAccountBalance(accountId: string): Promise<number> {
  return recalculateAccountBalance(accountId);
}


