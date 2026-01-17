/**
 * Balance Reconciliation Cron Job
 * Periodically verifies account balance integrity by recalculating balances
 * from transactions and fixing any discrepancies
 */

import cron from 'node-cron';
import {prisma} from '../utils/prisma';
import {logInfo, logError, logWarn} from '../utils/logger';

/**
 * Recalculate account balance from all transactions
 * @param accountId - Account ID to recalculate
 * @returns Calculated balance
 */
async function recalculateAccountBalanceFromTransactions(accountId: string): Promise<number> {
  const result = await prisma.transaction.aggregate({
    where: {accountId},
    _sum: {
      value: true,
    },
  });

  // Get initial balance
  const account = await prisma.account.findUnique({
    where: {id: accountId},
    select: {initBalance: true},
  });

  const initBalance = account ? Number(account.initBalance) : 0;
  const totalTransactions = result._sum.value ? Number(result._sum.value) : 0;

  // Balance = initial balance + sum of all transactions
  return initBalance + totalTransactions;
}

/**
 * Reconcile a single account balance
 * @param accountId - Account ID to reconcile
 * @returns Reconciliation result
 */
async function reconcileAccount(accountId: string): Promise<{
  accountId: string;
  storedBalance: number;
  calculatedBalance: number;
  discrepancy: number;
  fixed: boolean;
}> {
  const account = await prisma.account.findUnique({
    where: {id: accountId},
    select: {id: true, balance: true},
  });

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  const storedBalance = Number(account.balance);
  const calculatedBalance = await recalculateAccountBalanceFromTransactions(accountId);
  const discrepancy = calculatedBalance - storedBalance;

  let fixed = false;
  if (Math.abs(discrepancy) > 0.01) {
    // Only fix if discrepancy is more than 1 cent (to account for floating point errors)
    await prisma.account.update({
      where: {id: accountId},
      data: {balance: calculatedBalance},
    });
    fixed = true;
  }

  return {
    accountId,
    storedBalance,
    calculatedBalance,
    discrepancy,
    fixed,
  };
}

/**
 * Reconcile all account balances
 * @returns Reconciliation statistics
 */
export async function reconcileAccountBalances(): Promise<{
  total: number;
  discrepancies: number;
  fixed: number;
  results: Array<{
    accountId: string;
    storedBalance: number;
    calculatedBalance: number;
    discrepancy: number;
    fixed: boolean;
  }>;
}> {
  logInfo('Starting balance reconciliation', {});

  const accounts = await prisma.account.findMany({
    select: {id: true},
  });

  logInfo(`Found ${accounts.length} accounts to reconcile`, {
    count: accounts.length,
  });

  const results: Array<{
    accountId: string;
    storedBalance: number;
    calculatedBalance: number;
    discrepancy: number;
    fixed: boolean;
  }> = [];

  let discrepancies = 0;
  let fixed = 0;

  for (const account of accounts) {
    try {
      const result = await reconcileAccount(account.id);
      results.push(result);

      if (Math.abs(result.discrepancy) > 0.01) {
        discrepancies++;
        if (result.fixed) {
          fixed++;
          logWarn('Balance discrepancy found and fixed', {
            accountId: result.accountId,
            storedBalance: result.storedBalance,
            calculatedBalance: result.calculatedBalance,
            discrepancy: result.discrepancy,
          });
        }
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError('Failed to reconcile account balance', {
        accountId: account.id,
      }, errorObj);
    }
  }

  const stats = {
    total: accounts.length,
    discrepancies,
    fixed,
    results,
  };

  logInfo('Completed balance reconciliation', {
    total: stats.total,
    discrepancies: stats.discrepancies,
    fixed: stats.fixed,
  });

  if (discrepancies > 0) {
    logWarn('Balance discrepancies detected and fixed', {
      total: stats.total,
      discrepancies: stats.discrepancies,
      fixed: stats.fixed,
    });
  }

  return stats;
}

/**
 * Start cron job to run balance reconciliation weekly
 * Runs every Sunday at 2 AM
 */
export function startBalanceReconciliationCron(): void {
  // Run weekly on Sunday at 2 AM
  cron.schedule('0 2 * * 0', async (): Promise<void> => {
    try {
      logInfo('Balance reconciliation - started');
      const stats = await reconcileAccountBalances();
      logInfo('Balance reconciliation - completed', {
        total: stats.total,
        discrepancies: stats.discrepancies,
        fixed: stats.fixed,
      });
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError('Balance reconciliation - failed', {
        jobName: 'balanceReconciliation',
      }, errorObj);
    }
  });

  logInfo('Balance reconciliation - scheduled', {
    schedule: '0 2 * * 0',
    description: 'Weekly on Sunday at 2 AM',
  });
}
