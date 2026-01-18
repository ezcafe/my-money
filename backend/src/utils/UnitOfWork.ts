/**
 * Unit of Work Pattern
 * Manages database transactions and provides repositories bound to the transaction
 * Ensures all operations within a unit of work are atomic
 */

import type {PrismaClient} from '@prisma/client';
import type {PrismaTransaction} from '../repositories/BaseRepository';
import {getContainer} from './container';
import type {AccountRepository} from '../repositories/AccountRepository';
import type {CategoryRepository} from '../repositories/CategoryRepository';
import type {PayeeRepository} from '../repositories/PayeeRepository';
import type {TransactionRepository} from '../repositories/TransactionRepository';
import type {BudgetRepository} from '../repositories/BudgetRepository';
import type {RecurringTransactionRepository} from '../repositories/RecurringTransactionRepository';
import {retry, isRetryableError} from './retry';
import {logError, logInfo} from './logger';

/**
 * Unit of Work class
 * Manages a Prisma transaction and provides repositories bound to it
 * All operations within a unit of work are atomic
 */
export class UnitOfWork {
  private readonly tx: PrismaTransaction;
  private readonly container = getContainer();

  /**
   * Private constructor - use create() static method
   * @param tx - Prisma transaction client
   */
  private constructor(tx: PrismaTransaction) {
    this.tx = tx;
  }

  /**
   * Create a new UnitOfWork instance
   * Starts a new Prisma transaction with retry logic for transient errors
   * @param prisma - Prisma client
   * @param callback - Callback function that receives the UnitOfWork instance
   * @param options - Transaction options (timeout, isolation level, maxRetries)
   * @returns Result of the callback function
   * @throws Error if transaction fails (automatic rollback)
   */
  static async create<T>(
    prisma: PrismaClient,
    callback: (uow: UnitOfWork) => Promise<T>,
    options?: {
      timeout?: number;
      maxRetries?: number;
      isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
    },
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 3;
    const timeout = options?.timeout ?? 30000; // 30 seconds default

    return retry(
      async () => {
        return prisma.$transaction(
          async (tx) => {
            const uow = new UnitOfWork(tx);
            try {
              return await callback(uow);
            } catch (error) {
              // Transaction will automatically rollback on error
              const errorObj = error instanceof Error ? error : new Error(String(error));
              logError('Transaction failed', {
                event: 'transaction_failed',
                error: errorObj.message,
              }, errorObj);
              throw error;
            }
          },
          {
            timeout,
            isolationLevel: options?.isolationLevel,
          },
        );
      },
      {
        maxAttempts: maxRetries,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        retryableErrors: (error) => {
          // Retry on transient database errors
          if (isRetryableError(error)) {
            logInfo('Retrying transaction due to transient error', {
              event: 'transaction_retry',
              error: error.message,
            });
            return true;
          }
          return false;
        },
      },
    );
  }

  /**
   * Get the underlying transaction client
   * @returns Prisma transaction client
   */
  getTransaction(): PrismaTransaction {
    return this.tx;
  }

  /**
   * Get account repository bound to this transaction
   * @returns Account repository instance
   */
  getAccountRepository(): AccountRepository {
    return this.container.getAccountRepository(this.tx);
  }

  /**
   * Get category repository bound to this transaction
   * @returns Category repository instance
   */
  getCategoryRepository(): CategoryRepository {
    return this.container.getCategoryRepository(this.tx);
  }

  /**
   * Get payee repository bound to this transaction
   * @returns Payee repository instance
   */
  getPayeeRepository(): PayeeRepository {
    return this.container.getPayeeRepository(this.tx);
  }

  /**
   * Get transaction repository bound to this transaction
   * @returns Transaction repository instance
   */
  getTransactionRepository(): TransactionRepository {
    return this.container.getTransactionRepository(this.tx);
  }

  /**
   * Get budget repository bound to this transaction
   * @returns Budget repository instance
   */
  getBudgetRepository(): BudgetRepository {
    return this.container.getBudgetRepository(this.tx);
  }

  /**
   * Get recurring transaction repository bound to this transaction
   * @returns Recurring transaction repository instance
   */
  getRecurringTransactionRepository(): RecurringTransactionRepository {
    return this.container.getRecurringTransactionRepository(this.tx);
  }
}
