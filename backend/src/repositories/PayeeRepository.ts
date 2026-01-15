/**
 * Payee Repository
 * Handles all database operations for payees
 */

import type {Payee, PrismaClient} from '@prisma/client';
import {BaseRepository} from './BaseRepository';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Payee Repository
 * Provides data access methods for payees
 */
export class PayeeRepository extends BaseRepository {
  /**
   * Find payee by ID with ownership check
   * Payees can be user-specific or default (isDefault: true)
   * @param id - Payee ID
   * @param userId - User ID
   * @param select - Optional select clause
   * @returns Payee if found, null otherwise
   */
  async findById(
    id: string,
    userId: string,
    select?: Record<string, boolean>,
  ): Promise<Payee | null> {
    const queryOptions: {
      where: {
        id: string;
        OR: Array<{userId: string} | {isDefault: boolean; userId: null}>;
      };
      select?: Record<string, boolean>;
    } = {
      where: {
        id,
        OR: [
          {userId},
          {isDefault: true, userId: null},
        ],
      },
    };

    if (select) {
      queryOptions.select = select;
    }

    return this.prisma.payee.findFirst(queryOptions);
  }

  /**
   * Find all payees for a user (including defaults)
   * @param userId - User ID
   * @param select - Optional select clause
   * @returns Array of payees
   */
  async findMany(
    userId: string,
    select?: Record<string, boolean>,
  ): Promise<Payee[]> {
    const queryOptions: {
      where: {
        OR: Array<{userId: string} | {isDefault: boolean}>;
      };
      select?: Record<string, boolean>;
    } = {
      where: {
        OR: [
          {userId},
          {isDefault: true},
        ],
      },
    };

    if (select) {
      queryOptions.select = select;
    }

    return this.prisma.payee.findMany(queryOptions);
  }

  /**
   * Create a new payee
   * @param data - Payee data
   * @param tx - Optional transaction client
   * @returns Created payee
   */
  async create(
    data: {
      name: string;
      isDefault?: boolean;
      userId?: string | null;
    },
    tx?: PrismaTransaction,
  ): Promise<Payee> {
    const client = tx ?? this.prisma;
    return client.payee.create({data});
  }

  /**
   * Update a payee
   * @param id - Payee ID
   * @param data - Payee data to update
   * @param tx - Optional transaction client
   * @returns Updated payee
   */
  async update(
    id: string,
    data: {
      name?: string;
      isDefault?: boolean;
    },
    tx?: PrismaTransaction,
  ): Promise<Payee> {
    const client = tx ?? this.prisma;
    return client.payee.update({
      where: {id},
      data,
    });
  }

  /**
   * Delete a payee
   * @param id - Payee ID
   * @param tx - Optional transaction client
   * @returns Deleted payee
   */
  async delete(id: string, tx?: PrismaTransaction): Promise<Payee> {
    const client = tx ?? this.prisma;
    return client.payee.delete({
      where: {id},
    });
  }

  /**
   * Count payees for a user
   * @param userId - User ID
   * @returns Count of payees
   */
  async count(userId: string): Promise<number> {
    return this.prisma.payee.count({
      where: {
        OR: [
          {userId},
          {isDefault: true},
        ],
      },
    });
  }
}
