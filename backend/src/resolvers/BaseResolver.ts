/**
 * Base Resolver
 * Provides common functionality for all resolvers
 */

import type {ZodSchema} from 'zod';
import {NotFoundError} from '../utils/errors';
import type {PrismaClient} from '@prisma/client';
import {validate} from '../utils/validation';
import {sanitizeUserInput} from '../utils/sanitization';
import {AccountRepository} from '../repositories/AccountRepository';
import {CategoryRepository} from '../repositories/CategoryRepository';
import {PayeeRepository} from '../repositories/PayeeRepository';
import {TransactionRepository} from '../repositories/TransactionRepository';
import {RecurringTransactionRepository} from '../repositories/RecurringTransactionRepository';
import {BudgetRepository} from '../repositories/BudgetRepository';
import type {GraphQLContext} from '../middleware/context';
import {withPrismaErrorHandling} from '../utils/prismaErrors';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Base Resolver Class
 * Provides common methods for resolver operations
 * Uses repository pattern for data access
 */
export abstract class BaseResolver {
  /**
   * Verify entity belongs to user
   * Uses repository pattern for data access
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
    switch (model) {
      case 'account': {
        const repository = new AccountRepository(prisma);
        return (await repository.findById(id, userId, select)) as T | null;
      }
      case 'category': {
        const repository = new CategoryRepository(prisma);
        return (await repository.findById(id, userId, select)) as T | null;
      }
      case 'payee': {
        const repository = new PayeeRepository(prisma);
        return (await repository.findById(id, userId, select)) as T | null;
      }
      case 'transaction': {
        const repository = new TransactionRepository(prisma);
        return (await repository.findById(id, userId, select)) as T | null;
      }
      case 'recurringTransaction': {
        const repository = new RecurringTransactionRepository(prisma);
        return (await repository.findById(id, userId, select)) as T | null;
      }
      case 'budget': {
        const repository = new BudgetRepository(prisma);
        return (await repository.findById(id, userId, select)) as T | null;
      }
      default:
        return null;
    }
  }

  /**
   * Verify entity exists and belongs to user, throw error if not
   * Uses repository pattern for data access
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

  /**
   * Validate input against a Zod schema
   * @param schema - Zod schema to validate against
   * @param input - Input data to validate
   * @returns Validated and typed data
   * @throws ValidationError if validation fails
   */
  protected validateInput<T>(schema: ZodSchema<T>, input: unknown): T {
    return validate(schema, input);
  }

  /**
   * Validate and sanitize input against a Zod schema
   * Validates the input and sanitizes string fields
   * @param schema - Zod schema to validate against
   * @param input - Input data to validate and sanitize
   * @returns Validated, sanitized, and typed data
   * @throws ValidationError if validation fails
   */
  protected validateAndSanitizeInput<T extends Record<string, unknown>>(
    schema: ZodSchema<T>,
    input: unknown,
  ): T {
    const validated = validate(schema, input);
    // Sanitize string fields in the validated input
    const sanitized = {...validated};
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        (sanitized as Record<string, unknown>)[key] = sanitizeUserInput(value);
      }
    }
    return sanitized;
  }

  /**
   * Check if an entity with the given name already exists for the user
   * @param context - GraphQL context
   * @param model - Model name ('category' or 'payee')
   * @param name - Name to check
   * @param userId - User ID
   * @param excludeId - Optional ID to exclude from check (for updates)
   * @returns true if entity with name exists, false otherwise
   */
  protected async checkNameUniqueness(
    context: GraphQLContext,
    model: 'category' | 'payee',
    name: string,
    userId: string,
    excludeId?: string,
  ): Promise<boolean> {
    const where: {
      name: string;
      userId: string;
      id?: {not: string};
    } = {
      name,
      userId,
    };

    if (excludeId) {
      where.id = {not: excludeId};
    }

    const existing = await withPrismaErrorHandling(
      async () => {
        if (model === 'category') {
          return context.prisma.category.findFirst({
            where,
            select: {id: true},
          });
        }
        return context.prisma.payee.findFirst({
          where,
          select: {id: true},
        });
      },
      {resource: model.charAt(0).toUpperCase() + model.slice(1), operation: 'read'},
    );

    return existing !== null;
  }

  /**
   * Ensure default categories exist
   * Creates default categories if they don't exist
   * @param context - GraphQL context
   */
  protected async ensureDefaultCategories(context: GraphQLContext): Promise<void> {
    const defaultCategories = [
      {name: 'Default Expense Category', type: 'EXPENSE' as const},
      {name: 'Default Income Category', type: 'INCOME' as const},
    ];

    for (const categoryData of defaultCategories) {
      const existing = await withPrismaErrorHandling(
        async () =>
          await context.prisma.category.findFirst({
            where: {
              name: categoryData.name,
              isDefault: true,
              userId: null,
            },
            select: {id: true},
          }),
        {resource: 'Category', operation: 'read'},
      );

      if (!existing) {
        await withPrismaErrorHandling(
          async () =>
            await context.prisma.category.create({
              data: {
                name: categoryData.name,
                type: categoryData.type,
                isDefault: true,
                userId: null,
              },
            }),
          {resource: 'Category', operation: 'create'},
        );
      }
    }
  }

  /**
   * Ensure default payees exist
   * Creates default payees if they don't exist
   * @param context - GraphQL context
   */
  protected async ensureDefaultPayees(context: GraphQLContext): Promise<void> {
    const defaultPayeeNames = ['Default Payee'];

    for (const name of defaultPayeeNames) {
      const existing = await withPrismaErrorHandling(
        async () =>
          await context.prisma.payee.findFirst({
            where: {
              name,
              isDefault: true,
              userId: null,
            },
            select: {id: true},
          }),
        {resource: 'Payee', operation: 'read'},
      );

      if (!existing) {
        await withPrismaErrorHandling(
          async () =>
            await context.prisma.payee.create({
              data: {
                name,
                isDefault: true,
                userId: null,
              },
            }),
          {resource: 'Payee', operation: 'create'},
        );
      }
    }
  }
}

