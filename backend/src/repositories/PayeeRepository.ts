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
   * Find payee by ID in workspace
   * @param id - Payee ID
   * @param workspaceId - Workspace ID
   * @param select - Optional select clause
   * @returns Payee if found, null otherwise
   */
  async findById(
    id: string,
    workspaceId: string,
    select?: Record<string, boolean>,
  ): Promise<Payee | null> {
    const queryOptions: {
      where: {id: string; workspaceId: string};
      select?: Record<string, boolean>;
    } = {
      where: {id, workspaceId},
    };

    if (select) {
      queryOptions.select = select;
    }

    return this.prisma.payee.findFirst(queryOptions);
  }

  /**
   * Find all payees in a workspace
   * @param workspaceId - Workspace ID
   * @param select - Optional select clause
   * @returns Array of payees
   */
  async findMany(
    workspaceId: string,
    select?: Record<string, boolean>,
  ): Promise<Payee[]> {
    const queryOptions: {
      where: {workspaceId: string};
      select?: Record<string, boolean>;
    } = {
      where: {workspaceId},
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
      workspaceId: string;
      createdBy: string;
      lastEditedBy: string;
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
      lastEditedBy?: string;
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
   * Count payees in a workspace
   * @param workspaceId - Workspace ID
   * @returns Count of payees
   */
  async count(workspaceId: string): Promise<number> {
    return this.prisma.payee.count({
      where: {workspaceId},
    });
  }
}
