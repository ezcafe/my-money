/**
 * Account Balance Service
 * Handles account balance calculations and updates
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import {prisma} from '../utils/prisma';

/**
 * Calculate account balance from initial balance and all transactions
 * Optimized to use database aggregation instead of loading all transactions
 * @param accountId - Account ID
 * @returns Current balance
 */
export async function calculateAccountBalance(accountId: string): Promise<number> {
  const account = await prisma.account.findUnique({
    where: {id: accountId},
  });

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  // Use database aggregation for efficient balance calculation
  const balanceResult = await prisma.transaction.aggregate({
    where: {accountId},
    _sum: {value: true},
  });

  const transactionSum = balanceResult._sum.value
    ? Number(balanceResult._sum.value)
    : 0;

  return Number(account.initBalance) + transactionSum;
}

/**
 * Update account balance by adding a transaction value
 * This is used when a transaction is added via the calculator Add button
 * @param accountId - Account ID
 * @param transactionValue - Transaction value (can be positive or negative)
 * @returns Updated balance
 */
export async function updateAccountBalance(
  accountId: string,
  transactionValue: number,
): Promise<number> {
  // Get current account
  const account = await prisma.account.findUnique({
    where: {id: accountId},
  });

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  // Calculate new balance: currentTotal + transactionValue
  // If transactionValue is negative, it will subtract
  // If transactionValue is positive, it will add
  const currentBalance = await calculateAccountBalance(accountId);
  const newBalance = currentBalance + transactionValue;

  // Note: We don't update initBalance here, as the balance is calculated
  // from initBalance + sum of all transactions
  // The transaction itself will be created separately

  return newBalance;
}

/**
 * Get account balance (calculated)
 * @param accountId - Account ID
 * @returns Current balance
 */
export async function getAccountBalance(accountId: string): Promise<number> {
  return calculateAccountBalance(accountId);
}


