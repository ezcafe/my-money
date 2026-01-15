/**
 * Account Repository
 * Handles all database operations for accounts
 */

import type {Account, PrismaClient} from '@prisma/client';
import {BaseRepository} from './BaseRepository';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Account Repository
 * Provides data access methods for accounts
 */
export class AccountRepository extends BaseRepository {
  /**
   * Find account by ID with ownership check
   * @param id - Account ID
   * @param userId - User ID
   * @param select - Optional select clause
   * @returns Account if found, null otherwise
   */
  async findById(
    id: string,
    userId: string,
    select?: Record<string, boolean>,
  ): Promise<Account | null> {
    const queryOptions: {
      where: {id: string; userId: string};
      select?: Record<string, boolean>;
    } = {
      where: {id, userId},
    };

    if (select) {
      queryOptions.select = select;
    }

    return this.prisma.account.findFirst(queryOptions);
  }

  /**
   * Find all accounts for a user
   * @param userId - User ID
   * @param select - Optional select clause
   * @returns Array of accounts
   */
  async findMany(
    userId: string,
    select?: Record<string, boolean>,
  ): Promise<Account[]> {
    const queryOptions: {
      where: {userId: string};
      select?: Record<string, boolean>;
    } = {
      where: {userId},
    };

    if (select) {
      queryOptions.select = select;
    }

    return this.prisma.account.findMany(queryOptions);
  }

  /**
   * Find default account for a user
   * @param userId - User ID
   * @param select - Optional select clause
   * @returns Default account if found, null otherwise
   */
  async findDefault(
    userId: string,
    select?: Record<string, boolean>,
  ): Promise<Account | null> {
    const queryOptions: {
      where: {userId: string; isDefault: boolean};
      select?: Record<string, boolean>;
    } = {
      where: {userId, isDefault: true},
    };

    if (select) {
      queryOptions.select = select;
    }

    return this.prisma.account.findFirst(queryOptions);
  }

  /**
   * Create a new account
   * @param data - Account data
   * @param tx - Optional transaction client
   * @returns Created account
   */
  async create(
    data: {
      name: string;
      initBalance?: number;
      balance?: number;
      isDefault?: boolean;
      userId: string;
    },
    tx?: PrismaTransaction,
  ): Promise<Account> {
    const client = tx ?? this.prisma;
    return client.account.create({data});
  }

  /**
   * Update an account
   * @param id - Account ID
   * @param data - Account data to update
   * @param tx - Optional transaction client
   * @returns Updated account
   */
  async update(
    id: string,
    data: {
      name?: string;
      initBalance?: number;
      balance?: number;
      isDefault?: boolean;
    },
    tx?: PrismaTransaction,
  ): Promise<Account> {
    const client = tx ?? this.prisma;
    return client.account.update({
      where: {id},
      data,
    });
  }

  /**
   * Delete an account
   * @param id - Account ID
   * @param tx - Optional transaction client
   * @returns Deleted account
   */
  async delete(id: string, tx?: PrismaTransaction): Promise<Account> {
    const client = tx ?? this.prisma;
    return client.account.delete({
      where: {id},
    });
  }

  /**
   * Count accounts for a user
   * @param userId - User ID
   * @returns Count of accounts
   */
  async count(userId: string): Promise<number> {
    return this.prisma.account.count({
      where: {userId},
    });
  }

  /**
   * Increment account balance by a delta value
   * Atomic update using database increment operation
   * @param id - Account ID
   * @param delta - Value to add (can be positive or negative)
   * @param tx - Optional transaction client for atomicity
   * @returns Updated balance
   */
  async incrementBalance(
    id: string,
    delta: number,
    tx?: PrismaTransaction,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const account = await client.account.update({
      where: {id},
      data: {
        balance: {
          increment: delta,
        },
      },
      select: {balance: true},
    });
    return Number(account.balance);
  }
}
