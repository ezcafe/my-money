/**
 * Account Repository
 * Handles all database operations for accounts
 */

import type {Account, AccountType, PrismaClient} from '@prisma/client';
import {BaseRepository} from './BaseRepository';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Account Repository
 * Provides data access methods for accounts
 */
export class AccountRepository extends BaseRepository {
  /**
   * Find account by ID in workspace
   * @param id - Account ID
   * @param workspaceId - Workspace ID
   * @param select - Optional select clause
   * @returns Account if found, null otherwise
   */
  async findById(
    id: string,
    workspaceId: string,
    select?: Record<string, boolean>,
  ): Promise<Account | null> {
    return this.findByIdWithWorkspace(
      this.prisma.account,
      id,
      workspaceId,
      select ? {select} : undefined,
    );
  }

  /**
   * Find all accounts in a workspace
   * @param workspaceId - Workspace ID
   * @param select - Optional select clause
   * @returns Array of accounts
   */
  async findMany(
    workspaceId: string,
    select?: Record<string, boolean>,
  ): Promise<Account[]> {
    return this.findManyWithWorkspace(
      this.prisma.account,
      workspaceId,
      select ? {select} : undefined,
    );
  }

  /**
   * Find default account in a workspace
   * @param workspaceId - Workspace ID
   * @param select - Optional select clause
   * @returns Default account if found, null otherwise
   */
  async findDefault(
    workspaceId: string,
    select?: Record<string, boolean>,
  ): Promise<Account | null> {
    const queryOptions: {
      where: {workspaceId: string; isDefault: boolean};
      select?: Record<string, boolean>;
    } = {
      where: {workspaceId, isDefault: true},
    };

    if (select) {
      queryOptions.select = select;
    }

    return this.prisma.account.findFirst(queryOptions);
  }

  /**
   * Find account by name and account type in a workspace
   * @param workspaceId - Workspace ID
   * @param name - Account name
   * @param accountType - Account type
   * @param select - Optional select clause
   * @returns Account if found, null otherwise
   */
  async findByNameAndType(
    workspaceId: string,
    name: string,
    accountType: AccountType,
    select?: Record<string, boolean>,
  ): Promise<Account | null> {
    const queryOptions: {
      where: {workspaceId: string; name: string; accountType: AccountType};
      select?: Record<string, boolean>;
    } = {
      where: {workspaceId, name, accountType},
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
      accountType?: 'Cash' | 'CreditCard' | 'Bank' | 'Saving' | 'Loans';
      workspaceId: string;
      createdBy: string;
      lastEditedBy: string;
    },
    tx?: PrismaTransaction,
  ): Promise<Account> {
    const client = this.getClient(tx);
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
      accountType?: 'Cash' | 'CreditCard' | 'Bank' | 'Saving' | 'Loans';
    },
    tx?: PrismaTransaction,
  ): Promise<Account> {
    const client = this.getClient(tx);
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
    const client = this.getClient(tx);
    return client.account.delete({
      where: {id},
    });
  }

  /**
   * Count accounts in a workspace
   * @param workspaceId - Workspace ID
   * @returns Count of accounts
   */
  async count(workspaceId: string): Promise<number> {
    return this.countWithWorkspace(this.prisma.account, workspaceId);
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
