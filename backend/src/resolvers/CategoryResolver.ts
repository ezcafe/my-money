/**
 * Category Resolver
 * Handles category-related GraphQL operations
 */


import type {GraphQLContext} from '../middleware/context';
import type {Category} from '@prisma/client';
import {NotFoundError, ValidationError} from '../utils/errors';
import {z} from 'zod';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {sanitizeUserInput} from '../utils/sanitization';
import {BaseResolver} from './BaseResolver';

const CreateCategoryInputSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['INCOME', 'EXPENSE']),
});

const UpdateCategoryInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
});

export class CategoryResolver extends BaseResolver {
  /**
   * Get all categories (user-specific and default)
   */
  async categories(_: unknown, __: unknown, context: GraphQLContext): Promise<Category[]> {
    // Ensure default categories exist
    await this.ensureDefaultCategories(context);
    return await withPrismaErrorHandling(
      async () =>
        await context.prisma.category.findMany({
          where: {
            OR: [
              {userId: context.userId},
              {isDefault: true},
            ],
          },
          orderBy: [
            {isDefault: 'desc'},
            {name: 'asc'},
          ],
        }),
      {resource: 'Category', operation: 'read'},
    );
  }

  /**
   * Get category by ID
   */
  async category(_: unknown, {id}: {id: string}, context: GraphQLContext): Promise<Category | null> {
    return await withPrismaErrorHandling(
      async () =>
        await context.prisma.category.findFirst({
          where: {
            id,
            OR: [
              {userId: context.userId},
              {isDefault: true},
            ],
          },
        }),
      {resource: 'Category', operation: 'read'},
    );
  }

  /**
   * Create a new category
   */
  async createCategory(
    _: unknown,
    {input}: {input: {name: string; type: 'INCOME' | 'EXPENSE'}},
    context: GraphQLContext,
  ): Promise<Category> {
    const validatedInput = this.validateInput(CreateCategoryInputSchema, input);

    // Check if category with same name already exists for this user
    const nameExists = await this.checkNameUniqueness(context, 'category', validatedInput.name, context.userId);

    if (nameExists) {
      throw new ValidationError('Category with this name already exists');
    }

    const category = await withPrismaErrorHandling(
      async () =>
        await context.prisma.category.create({
          data: {
            name: sanitizeUserInput(validatedInput.name),
            type: validatedInput.type,
            userId: context.userId,
            isDefault: false,
          },
        }),
      {resource: 'Category', operation: 'create'},
    );

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(
    _: unknown,
    {id, input}: {id: string; input: {name?: string; type?: 'INCOME' | 'EXPENSE'}},
    context: GraphQLContext,
  ): Promise<Category> {
    const validatedInput = this.validateInput(UpdateCategoryInputSchema, input);

    // Verify category belongs to user (cannot update default categories)
    const existing = await withPrismaErrorHandling(
      async () =>
        await context.prisma.category.findFirst({
          where: {
            id,
            userId: context.userId,
            isDefault: false,
          },
          select: {id: true, name: true},
        }),
      {resource: 'Category', operation: 'read'},
    );

    if (!existing) {
      throw new NotFoundError('Category');
    }

    // Check name uniqueness if name is being updated
    if (validatedInput.name && validatedInput.name !== existing.name) {
      const nameExists = await this.checkNameUniqueness(context, 'category', validatedInput.name, context.userId, id);

      if (nameExists) {
        throw new ValidationError('Category with this name already exists');
      }
    }

    return await withPrismaErrorHandling(
      async () =>
        await context.prisma.category.update({
          where: {id},
          data: {
            ...(validatedInput.name !== undefined && {name: sanitizeUserInput(validatedInput.name)}),
            ...(validatedInput.type !== undefined && {type: validatedInput.type}),
          },
        }),
      {resource: 'Category', operation: 'update'},
    );
  }

  /**
   * Delete category (cannot delete default categories)
   */
  async deleteCategory(_: unknown, {id}: {id: string}, context: GraphQLContext): Promise<boolean> {
    // Verify category belongs to user and is not default
    const category = await withPrismaErrorHandling(
      async () =>
        await context.prisma.category.findFirst({
          where: {
            id,
            userId: context.userId,
            isDefault: false,
          },
          select: {id: true},
        }),
      {resource: 'Category', operation: 'read'},
    );

    if (!category) {
      throw new NotFoundError('Category');
    }

    await withPrismaErrorHandling(
      async () =>
        await context.prisma.category.delete({
          where: {id},
        }),
      {resource: 'Category', operation: 'delete'},
    );

    return true;
  }
}

