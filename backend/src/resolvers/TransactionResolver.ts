/**
 * Transaction Resolver
 * Main resolver that delegates to specialized resolvers
 * Split into Query, Mutation, and Field resolvers for better organization
 */

import type {GraphQLContext} from '../middleware/context';
import type {Transaction} from '@prisma/client';
import {TransactionQueryResolver} from './transaction/TransactionQueryResolver';
import {TransactionMutationResolver} from './transaction/TransactionMutationResolver';
import {TransactionFieldResolver} from './transaction/TransactionFieldResolver';

/**
 * Transaction Resolver
 * Delegates to specialized resolvers for better code organization
 */
export class TransactionResolver {
  private readonly queryResolver = new TransactionQueryResolver();
  private readonly mutationResolver = new TransactionMutationResolver();
  public readonly fieldResolver = new TransactionFieldResolver();
  /**
   * Get transactions with pagination
   * Delegates to TransactionQueryResolver
   */
  async transactions(
    _: unknown,
    {
      accountId,
      categoryId,
      payeeId,
      first,
      after,
      last,
      before,
      orderBy,
      note,
    }: {
      accountId?: string;
      categoryId?: string;
      payeeId?: string;
      first?: number;
      after?: string;
      last?: number;
      before?: string;
      orderBy?: {field: 'date' | 'value' | 'category' | 'account' | 'payee'; direction: 'asc' | 'desc'};
      note?: string;
    },
    context: GraphQLContext,
  ): Promise<{items: Transaction[]; totalCount: number; hasMore: boolean; nextCursor: string | null}> {
    return this.queryResolver.transactions(_, {
      accountId,
      categoryId,
      payeeId,
      first,
      after,
      last,
      before,
      orderBy,
      note,
    }, context);
  }

  /**
   * Get last N transactions for home page
   * Delegates to TransactionQueryResolver
   */
  async recentTransactions(
    _: unknown,
    args: {limit?: number; orderBy?: {field: 'date' | 'value' | 'category' | 'account' | 'payee'; direction: 'asc' | 'desc'}},
    context: GraphQLContext,
  ): Promise<Transaction[]> {
    return this.queryResolver.recentTransactions(_, args, context);
  }

  /**
   * Get transaction by ID
   * Delegates to TransactionQueryResolver
   */
  async transaction(_: unknown, {id}: {id: string}, context: GraphQLContext): Promise<Transaction | null> {
    return this.queryResolver.transaction(_, {id}, context);
  }

  /**
   * Get top 5 most used transaction values
   * Delegates to TransactionQueryResolver
   */
  async topUsedValues(
    _: unknown,
    {days = 90}: {days?: number},
    context: GraphQLContext,
  ): Promise<Array<{value: string; count: number}>> {
    return this.queryResolver.topUsedValues(_, {days}, context);
  }

  /**
   * Get most commonly used transaction details for a specific amount
   * Delegates to TransactionQueryResolver
   */
  async mostUsedTransactionDetails(
    _: unknown,
    {amount, days = 90}: {amount: number; days?: number},
    context: GraphQLContext,
  ): Promise<{accountId: string | null; payeeId: string | null; categoryId: string | null; count: number} | null> {
    return this.queryResolver.mostUsedTransactionDetails(_, {amount, days}, context);
  }

  /**
   * Create a transaction
   * Delegates to TransactionMutationResolver
   */
  async createTransaction(
    _: unknown,
    {input}: {input: unknown},
    context: GraphQLContext,
  ): Promise<Transaction> {
    return this.mutationResolver.createTransaction(_, {input}, context);
  }

  /**
   * Update transaction
   * Delegates to TransactionMutationResolver
   */
  async updateTransaction(
    _: unknown,
    {id, input}: {id: string; input: unknown},
    context: GraphQLContext,
  ): Promise<Transaction> {
    return this.mutationResolver.updateTransaction(_, {id, input}, context);
  }

  /**
   * Delete transaction
   * Delegates to TransactionMutationResolver
   */
  async deleteTransaction(_: unknown, {id}: {id: string}, context: GraphQLContext): Promise<boolean> {
    return this.mutationResolver.deleteTransaction(_, {id}, context);
  }

  /**
   * Field resolver for versions
   * Delegates to TransactionFieldResolver
   */
  async versions(parent: Transaction, _: unknown, context: GraphQLContext): Promise<unknown> {
    return this.fieldResolver.versions(parent, _, context);
  }

  /**
   * Field resolver for createdBy
   * Delegates to TransactionFieldResolver
   */
  async createdBy(parent: Transaction, _: unknown, context: GraphQLContext): Promise<unknown> {
    return this.fieldResolver.createdBy(parent, _, context);
  }

  /**
   * Field resolver for lastEditedBy
   * Delegates to TransactionFieldResolver
   */
  async lastEditedBy(parent: Transaction, _: unknown, context: GraphQLContext): Promise<unknown> {
    return this.fieldResolver.lastEditedBy(parent, _, context);
  }
}


