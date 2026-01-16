/**
 * Category Repository
 * Handles all database operations for categories
 */

import type {Category, PrismaClient} from '@prisma/client';
import {BaseRepository} from './BaseRepository';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Category Repository
 * Provides data access methods for categories
 */
export class CategoryRepository extends BaseRepository {
  /**
   * Find category by ID with ownership check
   * Categories can be user-specific or default (isDefault: true)
   * @param id - Category ID
   * @param userId - User ID
   * @param select - Optional select clause
   * @returns Category if found, null otherwise
   */
  async findById(
    id: string,
    userId: string,
    select?: Record<string, boolean>,
  ): Promise<Category | null> {
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

    return this.prisma.category.findFirst(queryOptions);
  }

  /**
   * Find all categories for a user (including defaults)
   * @param userId - User ID
   * @param select - Optional select clause
   * @returns Array of categories
   */
  async findMany(
    userId: string,
    select?: Record<string, boolean>,
  ): Promise<Category[]> {
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

    return this.prisma.category.findMany(queryOptions);
  }

  /**
   * Create a new category
   * @param data - Category data
   * @param tx - Optional transaction client
   * @returns Created category
   */
  async create(
    data: {
      name: string;
      categoryType: 'Income' | 'Expense';
      isDefault?: boolean;
      userId?: string | null;
    },
    tx?: PrismaTransaction,
  ): Promise<Category> {
    const client = tx ?? this.prisma;
    return client.category.create({data});
  }

  /**
   * Update a category
   * @param id - Category ID
   * @param data - Category data to update
   * @param tx - Optional transaction client
   * @returns Updated category
   */
  async update(
    id: string,
    data: {
      name?: string;
      categoryType?: 'Income' | 'Expense';
      isDefault?: boolean;
    },
    tx?: PrismaTransaction,
  ): Promise<Category> {
    const client = tx ?? this.prisma;
    return client.category.update({
      where: {id},
      data,
    });
  }

  /**
   * Delete a category
   * @param id - Category ID
   * @param tx - Optional transaction client
   * @returns Deleted category
   */
  async delete(id: string, tx?: PrismaTransaction): Promise<Category> {
    const client = tx ?? this.prisma;
    return client.category.delete({
      where: {id},
    });
  }

  /**
   * Count categories for a user
   * @param userId - User ID
   * @returns Count of categories
   */
  async count(userId: string): Promise<number> {
    return this.prisma.category.count({
      where: {
        OR: [
          {userId},
          {isDefault: true},
        ],
      },
    });
  }
}
