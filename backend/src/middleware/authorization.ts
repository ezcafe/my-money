/**
 * Authorization Middleware
 * Provides consistent authorization checks for resolvers
 */

import type {GraphQLContext} from './context';
import {NotFoundError} from '../utils/errors';
import {AccountRepository} from '../repositories/AccountRepository';
import {CategoryRepository} from '../repositories/CategoryRepository';
import {PayeeRepository} from '../repositories/PayeeRepository';
import {TransactionRepository} from '../repositories/TransactionRepository';
import {BudgetRepository} from '../repositories/BudgetRepository';
import {RecurringTransactionRepository} from '../repositories/RecurringTransactionRepository';

/**
 * Entity model types for authorization
 */
type EntityModel = 'account' | 'category' | 'payee' | 'transaction' | 'recurringTransaction' | 'budget';

/**
 * Check if entity belongs to user
 * @param model - Entity model name
 * @param id - Entity ID
 * @param userId - User ID
 * @param context - GraphQL context
 * @returns True if entity belongs to user, false otherwise
 */
async function checkEntityOwnership(
  model: EntityModel,
  id: string,
  userId: string,
  context: GraphQLContext,
): Promise<boolean> {
  switch (model) {
    case 'account': {
      const repository = new AccountRepository(context.prisma);
      const entity = await repository.findById(id, userId, {id: true});
      return entity !== null;
    }
    case 'category': {
      const repository = new CategoryRepository(context.prisma);
      const entity = await repository.findById(id, userId, {id: true});
      return entity !== null;
    }
    case 'payee': {
      const repository = new PayeeRepository(context.prisma);
      const entity = await repository.findById(id, userId, {id: true});
      return entity !== null;
    }
    case 'transaction': {
      const repository = new TransactionRepository(context.prisma);
      const entity = await repository.findById(id, userId, {id: true});
      return entity !== null;
    }
    case 'recurringTransaction': {
      const repository = new RecurringTransactionRepository(context.prisma);
      const entity = await repository.findById(id, userId, {id: true});
      return entity !== null;
    }
    case 'budget': {
      const repository = new BudgetRepository(context.prisma);
      const entity = await repository.findById(id, userId, {id: true});
      return entity !== null;
    }
    default:
      return false;
  }
}

/**
 * Require entity ownership - throws error if entity doesn't belong to user
 * @param model - Entity model name
 * @param id - Entity ID
 * @param userId - User ID
 * @param context - GraphQL context
 * @throws NotFoundError if entity not found or doesn't belong to user
 */
export async function requireOwnership(
  model: EntityModel,
  id: string,
  userId: string,
  context: GraphQLContext,
): Promise<void> {
  const hasAccess = await checkEntityOwnership(model, id, userId, context);
  if (!hasAccess) {
    const modelName = model.charAt(0).toUpperCase() + model.slice(1);
    throw new NotFoundError(modelName);
  }
}

/**
 * Authorization middleware wrapper
 * Wraps a resolver function to check entity ownership before execution
 * @param model - Entity model name
 * @param getId - Function to extract entity ID from resolver arguments
 * @param resolver - Resolver function to wrap
 * @returns Wrapped resolver with authorization check
 */
export function withAuthorization<TArgs, TReturn>(
  model: EntityModel,
  getId: (args: TArgs) => string,
  resolver: (
    parent: unknown,
    args: TArgs,
    context: GraphQLContext,
    info: unknown,
  ) => Promise<TReturn> | TReturn,
): (
  parent: unknown,
  args: TArgs,
  context: GraphQLContext,
  info: unknown,
) => Promise<TReturn> {
  return async (parent, args, context, info) => {
    const id = getId(args);
    await requireOwnership(model, id, context.userId, context);
    return resolver(parent, args, context, info);
  };
}

/**
 * Check if user can access an account
 * @param accountId - Account ID
 * @param userId - User ID
 * @param context - GraphQL context
 * @throws NotFoundError if account not found or doesn't belong to user
 */
export async function requireAccountAccess(
  accountId: string,
  userId: string,
  context: GraphQLContext,
): Promise<void> {
  await requireOwnership('account', accountId, userId, context);
}

/**
 * Check if user can access a category
 * @param categoryId - Category ID
 * @param userId - User ID
 * @param context - GraphQL context
 * @throws NotFoundError if category not found or not accessible
 */
export async function requireCategoryAccess(
  categoryId: string,
  userId: string,
  context: GraphQLContext,
): Promise<void> {
  await requireOwnership('category', categoryId, userId, context);
}

/**
 * Check if user can access a payee
 * @param payeeId - Payee ID
 * @param userId - User ID
 * @param context - GraphQL context
 * @throws NotFoundError if payee not found or not accessible
 */
export async function requirePayeeAccess(
  payeeId: string,
  userId: string,
  context: GraphQLContext,
): Promise<void> {
  await requireOwnership('payee', payeeId, userId, context);
}

/**
 * Check if user can access a transaction
 * @param transactionId - Transaction ID
 * @param userId - User ID
 * @param context - GraphQL context
 * @throws NotFoundError if transaction not found or doesn't belong to user
 */
export async function requireTransactionAccess(
  transactionId: string,
  userId: string,
  context: GraphQLContext,
): Promise<void> {
  await requireOwnership('transaction', transactionId, userId, context);
}
