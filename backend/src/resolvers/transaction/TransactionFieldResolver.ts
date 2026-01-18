/**
 * Transaction Field Resolver
 * Handles field-level resolvers for Transaction type
 */

import type {GraphQLContext} from '../../middleware/context';
import type {Transaction} from '@prisma/client';
import {getContainer} from '../../utils/container';

/**
 * Transaction Field Resolver
 * Handles field-level resolvers for Transaction relations
 */
export class TransactionFieldResolver {
  /**
   * Field resolver for versions
   */
  async versions(parent: Transaction, _: unknown, context: GraphQLContext): Promise<unknown> {
    const versionService = getContainer().getVersionService(context.prisma);
    return versionService.getEntityVersions('Transaction', parent.id);
  }

  /**
   * Field resolver for createdBy
   */
  async createdBy(parent: Transaction, _: unknown, context: GraphQLContext): Promise<unknown> {
    return context.userLoader.load(parent.createdBy);
  }

  /**
   * Field resolver for lastEditedBy
   */
  async lastEditedBy(parent: Transaction, _: unknown, context: GraphQLContext): Promise<unknown> {
    return context.userLoader.load(parent.lastEditedBy);
  }

  /**
   * Field resolver for account
   * Uses DataLoader for efficient batching
   */
  async account(parent: Transaction, _: unknown, context: GraphQLContext): Promise<unknown> {
    return context.accountLoader.load(parent.accountId);
  }

  /**
   * Field resolver for category
   * Uses DataLoader for efficient batching
   */
  async category(parent: Transaction, _: unknown, context: GraphQLContext): Promise<unknown> {
    if (!parent.categoryId) {
      return null;
    }
    return context.categoryLoader.load(parent.categoryId);
  }

  /**
   * Field resolver for payee
   * Uses DataLoader for efficient batching
   */
  async payee(parent: Transaction, _: unknown, context: GraphQLContext): Promise<unknown> {
    if (!parent.payeeId) {
      return null;
    }
    return context.payeeLoader.load(parent.payeeId);
  }
}
