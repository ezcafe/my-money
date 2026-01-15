/**
 * Recurring Transaction Repository
 * Handles all database operations for recurring transactions
 */

import type {RecurringTransaction, PrismaClient} from '@prisma/client';
import {BaseRepository} from './BaseRepository';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Recurring Transaction Repository
 * Provides data access methods for recurring transactions
 */
export class RecurringTransactionRepository extends BaseRepository {
  /**
   * Find recurring transaction by ID with ownership check
   * @param id - Recurring transaction ID
   * @param userId - User ID
   * @param select - Optional select clause
   * @param include - Optional include clause
   * @returns Recurring transaction if found, null otherwise
   */
  async findById(
    id: string,
    userId: string,
    select?: Record<string, boolean>,
    include?: Record<string, boolean>,
  ): Promise<RecurringTransaction | null> {
    const queryOptions: {
      where: {id: string; userId: string};
      select?: Record<string, boolean>;
      include?: Record<string, boolean>;
    } = {
      where: {id, userId},
    };

    if (select) {
      queryOptions.select = select;
    } else if (include) {
      queryOptions.include = include;
    }

    return this.prisma.recurringTransaction.findFirst(queryOptions);
  }

  /**
   * Find all recurring transactions for a user
   * @param userId - User ID
   * @param select - Optional select clause
   * @param include - Optional include clause
   * @returns Array of recurring transactions
   */
  async findMany(
    userId: string,
    select?: Record<string, boolean>,
    include?: Record<string, boolean>,
  ): Promise<RecurringTransaction[]> {
    const queryOptions: {
      where: {userId: string};
      select?: Record<string, boolean>;
      include?: Record<string, boolean>;
    } = {
      where: {userId},
    };

    if (select) {
      queryOptions.select = select;
    } else if (include) {
      queryOptions.include = include;
    }

    return this.prisma.recurringTransaction.findMany(queryOptions);
  }

  /**
   * Find recurring transactions due to run
   * @param date - Date to check (default: now)
   * @param select - Optional select clause
   * @returns Array of recurring transactions due to run
   */
  async findDueToRun(
    date: Date = new Date(),
    select?: Record<string, boolean>,
  ): Promise<RecurringTransaction[]> {
    const queryOptions: {
      where: {nextRunDate: {lte: Date}};
      select?: Record<string, boolean>;
    } = {
      where: {
        nextRunDate: {
          lte: date,
        },
      },
    };

    if (select) {
      queryOptions.select = select;
    }

    return this.prisma.recurringTransaction.findMany(queryOptions);
  }

  /**
   * Create a new recurring transaction
   * @param data - Recurring transaction data
   * @param tx - Optional transaction client
   * @returns Created recurring transaction
   */
  async create(
    data: {
      cronExpression: string;
      value: number;
      accountId: string;
      categoryId?: string | null;
      payeeId?: string | null;
      note?: string | null;
      nextRunDate: Date;
      userId: string;
    },
    tx?: PrismaTransaction,
  ): Promise<RecurringTransaction> {
    const client = tx ?? this.prisma;
    return client.recurringTransaction.create({data});
  }

  /**
   * Update a recurring transaction
   * @param id - Recurring transaction ID
   * @param data - Recurring transaction data to update
   * @param tx - Optional transaction client
   * @returns Updated recurring transaction
   */
  async update(
    id: string,
    data: {
      cronExpression?: string;
      value?: number;
      accountId?: string;
      categoryId?: string | null;
      payeeId?: string | null;
      note?: string | null;
      nextRunDate?: Date;
    },
    tx?: PrismaTransaction,
  ): Promise<RecurringTransaction> {
    const client = tx ?? this.prisma;
    return client.recurringTransaction.update({
      where: {id},
      data,
    });
  }

  /**
   * Delete a recurring transaction
   * @param id - Recurring transaction ID
   * @param tx - Optional transaction client
   * @returns Deleted recurring transaction
   */
  async delete(id: string, tx?: PrismaTransaction): Promise<RecurringTransaction> {
    const client = tx ?? this.prisma;
    return client.recurringTransaction.delete({
      where: {id},
    });
  }

  /**
   * Count recurring transactions for a user
   * @param userId - User ID
   * @returns Count of recurring transactions
   */
  async count(userId: string): Promise<number> {
    return this.prisma.recurringTransaction.count({
      where: {userId},
    });
  }
}
