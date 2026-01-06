/**
 * Base Resolver
 * Provides common functionality for all resolvers
 */

import {NotFoundError} from '../utils/errors';
import type {PrismaClient} from '@prisma/client';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Base Resolver Class
 * Provides common methods for resolver operations
 */
export abstract class BaseResolver {
  /**
   * Verify entity belongs to user
   * @param prisma - Prisma client or transaction
   * @param model - Prisma model name (e.g., 'account', 'category')
   * @param id - Entity ID
   * @param userId - User ID
   * @param select - Optional select clause for optimization
   * @returns Entity if found, null otherwise
   */
  protected async verifyEntityOwnership<T>(
    prisma: PrismaTransaction | PrismaClient,
    model: 'account' | 'category' | 'payee' | 'transaction' | 'recurringTransaction' | 'budget',
    id: string,
    userId: string,
    select?: Record<string, boolean>,
  ): Promise<T | null> {
    const where = {id, userId};
    const queryOptions: {where: typeof where; select?: Record<string, boolean>} = {where};

    if (select) {
      queryOptions.select = select;
    }

    switch (model) {
      case 'account':
        return (await prisma.account.findFirst(queryOptions)) as T | null;
      case 'category':
        return (await prisma.category.findFirst({
          ...queryOptions,
          where: {
            id,
            OR: [
              {userId},
              {isDefault: true, userId: null},
            ],
          },
        })) as T | null;
      case 'payee':
        return (await prisma.payee.findFirst({
          ...queryOptions,
          where: {
            id,
            OR: [
              {userId},
              {isDefault: true, userId: null},
            ],
          },
        })) as T | null;
      case 'transaction':
        return (await prisma.transaction.findFirst(queryOptions)) as T | null;
      case 'recurringTransaction':
        return (await prisma.recurringTransaction.findFirst(queryOptions)) as T | null;
      case 'budget':
        return (await prisma.budget.findFirst(queryOptions)) as T | null;
      default:
        return null;
    }
  }

  /**
   * Verify entity exists and belongs to user, throw error if not
   * @param prisma - Prisma client or transaction
   * @param model - Prisma model name
   * @param id - Entity ID
   * @param userId - User ID
   * @param select - Optional select clause for optimization
   * @returns Entity
   * @throws NotFoundError if entity not found
   */
  protected async requireEntityOwnership<T>(
    prisma: PrismaTransaction | PrismaClient,
    model: 'account' | 'category' | 'payee' | 'transaction' | 'recurringTransaction' | 'budget',
    id: string,
    userId: string,
    select?: Record<string, boolean>,
  ): Promise<T> {
    const entity = await this.verifyEntityOwnership<T>(prisma, model, id, userId, select);
    if (!entity) {
      throw new NotFoundError(model.charAt(0).toUpperCase() + model.slice(1));
    }
    return entity;
  }
}

