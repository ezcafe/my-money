/**
 * Budget Repository
 * Handles all database operations for budgets
 */

import type { Budget, PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Budget Repository
 * Provides data access methods for budgets
 */
export class BudgetRepository extends BaseRepository {
  /**
   * Find budget by ID in workspace
   * @param id - Budget ID
   * @param workspaceId - Workspace ID
   * @param select - Optional select clause
   * @param include - Optional include clause
   * @returns Budget if found, null otherwise
   */
  async findById(
    id: string,
    workspaceId: string,
    select?: Record<string, boolean>,
    include?: Record<string, boolean>
  ): Promise<Budget | null> {
    const queryOptions: {
      where: { id: string; workspaceId: string };
      select?: Record<string, boolean>;
      include?: Record<string, boolean>;
    } = {
      where: { id, workspaceId },
    };

    if (select) {
      queryOptions.select = select;
    } else if (include) {
      queryOptions.include = include;
    }

    return this.prisma.budget.findFirst(queryOptions);
  }

  /**
   * Find many budgets in a workspace with filters
   * @param workspaceId - Workspace ID
   * @param filters - Optional filters (accountId, categoryId, payeeId)
   * @param select - Optional select clause
   * @param include - Optional include clause
   * @returns Array of budgets
   */
  async findMany(
    workspaceId: string,
    filters?: {
      accountId?: string;
      categoryId?: string;
      payeeId?: string;
    },
    select?: Record<string, boolean>,
    include?: Record<string, boolean>
  ): Promise<Budget[]> {
    const where: {
      workspaceId: string;
      accountId?: string;
      categoryId?: string;
      payeeId?: string;
    } = { workspaceId };

    if (filters?.accountId) {
      where.accountId = filters.accountId;
    }
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters?.payeeId) {
      where.payeeId = filters.payeeId;
    }

    const queryOptions: {
      where: typeof where;
      select?: Record<string, boolean>;
      include?: Record<string, boolean>;
    } = { where };

    if (select) {
      queryOptions.select = select;
    } else if (include) {
      queryOptions.include = include;
    }

    return this.prisma.budget.findMany(queryOptions);
  }

  /**
   * Find budgets affected by a transaction
   * @param transaction - Transaction data
   * @param workspaceId - Workspace ID
   * @param tx - Optional transaction client
   * @returns Array of affected budgets
   */
  async findAffectedByTransaction(
    transaction: {
      accountId: string;
      categoryId: string | null;
      payeeId: string | null;
    },
    workspaceId: string,
    tx?: PrismaTransaction
  ): Promise<Array<{ id: string; amount: number; currentSpent: number }>> {
    const client = tx ?? this.prisma;
    const budgets = await client.budget.findMany({
      where: {
        workspaceId,
        OR: [
          { accountId: transaction.accountId },
          { categoryId: transaction.categoryId },
          { payeeId: transaction.payeeId },
        ],
      },
      select: {
        id: true,
        amount: true,
        currentSpent: true,
      },
    });
    return budgets.map((b) => ({
      id: b.id,
      amount: Number(b.amount),
      currentSpent: Number(b.currentSpent),
    }));
  }

  /**
   * Create a new budget
   * @param data - Budget data
   * @param tx - Optional transaction client
   * @returns Created budget
   */
  async create(
    data: {
      workspaceId: string;
      amount: number;
      accountId?: string | null;
      categoryId?: string | null;
      payeeId?: string | null;
      createdBy: string;
      lastEditedBy: string;
    },
    tx?: PrismaTransaction
  ): Promise<Budget> {
    const client = tx ?? this.prisma;
    return client.budget.create({ data });
  }

  /**
   * Update a budget
   * @param id - Budget ID
   * @param data - Budget data to update
   * @param tx - Optional transaction client
   * @returns Updated budget
   */
  async update(
    id: string,
    data: {
      amount?: number;
      currentSpent?: number;
      lastResetDate?: Date;
      lastEditedBy?: string;
    },
    tx?: PrismaTransaction
  ): Promise<Budget> {
    const client = tx ?? this.prisma;
    return client.budget.update({
      where: { id },
      data,
    });
  }

  /**
   * Update many budgets
   * @param where - Where clause
   * @param data - Budget data to update
   * @param tx - Optional transaction client
   * @returns Count of updated budgets
   */
  async updateMany(
    where: {
      workspaceId: string;
      OR?: Array<{
        accountId?: string;
        categoryId?: string;
        payeeId?: string;
      }>;
    },
    data: {
      currentSpent?: number;
      lastResetDate?: Date;
    },
    tx?: PrismaTransaction
  ): Promise<{ count: number }> {
    const client = tx ?? this.prisma;
    return client.budget.updateMany({
      where,
      data,
    });
  }

  /**
   * Delete a budget
   * @param id - Budget ID
   * @param tx - Optional transaction client
   * @returns Deleted budget
   */
  async delete(id: string, tx?: PrismaTransaction): Promise<Budget> {
    const client = tx ?? this.prisma;
    return client.budget.delete({
      where: { id },
    });
  }

  /**
   * Count budgets in a workspace
   * @param workspaceId - Workspace ID
   * @returns Count of budgets
   */
  async count(workspaceId: string): Promise<number> {
    return this.prisma.budget.count({
      where: { workspaceId },
    });
  }

  /**
   * Find first budget matching criteria
   * @param where - Where clause
   * @param select - Optional select clause
   * @param tx - Optional transaction client
   * @returns Budget if found, null otherwise
   */
  async findFirst(
    where: {
      id?: string;
      workspaceId?: string;
      accountId?: string | null;
      categoryId?: string | null;
      payeeId?: string | null;
    },
    select?: Record<string, boolean>,
    tx?: PrismaTransaction
  ): Promise<Budget | null> {
    const client = tx ?? this.prisma;
    const queryOptions: {
      where: typeof where;
      select?: Record<string, boolean>;
    } = { where };

    if (select) {
      queryOptions.select = select;
    }

    return client.budget.findFirst(queryOptions);
  }

  /**
   * Find unique budget by ID
   * @param id - Budget ID
   * @param select - Optional select clause
   * @param tx - Optional transaction client
   * @returns Budget if found, null otherwise
   */
  async findUnique(
    id: string,
    select?: Record<string, boolean>,
    tx?: PrismaTransaction
  ): Promise<Budget | null> {
    const client = tx ?? this.prisma;
    const queryOptions: {
      where: { id: string };
      select?: Record<string, boolean>;
    } = {
      where: { id },
    };

    if (select) {
      queryOptions.select = select;
    }

    return client.budget.findUnique(queryOptions);
  }
}
