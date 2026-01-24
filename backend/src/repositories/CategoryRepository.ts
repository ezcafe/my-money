/**
 * Category Repository
 * Handles all database operations for categories
 */

import type { Category, PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Category Repository
 * Provides data access methods for categories
 */
export class CategoryRepository extends BaseRepository {
  /**
   * Find category by ID in workspace
   * @param id - Category ID
   * @param workspaceId - Workspace ID
   * @param select - Optional select clause
   * @returns Category if found, null otherwise
   */
  async findById(
    id: string,
    workspaceId: string,
    select?: Record<string, boolean>
  ): Promise<Category | null> {
    const queryOptions: {
      where: { id: string; workspaceId: string };
      select?: Record<string, boolean>;
    } = {
      where: { id, workspaceId },
    };

    if (select) {
      queryOptions.select = select;
    }

    return this.prisma.category.findFirst(queryOptions);
  }

  /**
   * Find all categories in a workspace
   * @param workspaceId - Workspace ID
   * @param select - Optional select clause
   * @returns Array of categories
   */
  async findMany(
    workspaceId: string,
    select?: Record<string, boolean>
  ): Promise<Category[]> {
    const queryOptions: {
      where: { workspaceId: string };
      select?: Record<string, boolean>;
    } = {
      where: { workspaceId },
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
      workspaceId: string;
      createdBy: string;
      lastEditedBy: string;
    },
    tx?: PrismaTransaction
  ): Promise<Category> {
    const client = tx ?? this.prisma;
    return client.category.create({ data });
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
      lastEditedBy?: string;
    },
    tx?: PrismaTransaction
  ): Promise<Category> {
    const client = tx ?? this.prisma;
    return client.category.update({
      where: { id },
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
      where: { id },
    });
  }

  /**
   * Count categories in a workspace
   * @param workspaceId - Workspace ID
   * @returns Count of categories
   */
  async count(workspaceId: string): Promise<number> {
    return this.prisma.category.count({
      where: { workspaceId },
    });
  }
}
