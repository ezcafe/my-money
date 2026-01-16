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
  categoryType: z.enum(['Income', 'Expense']),
});

const UpdateCategoryInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  categoryType: z.enum(['Income', 'Expense']).optional(),
});

export class CategoryResolver extends BaseResolver {
  /**
   * Get all categories (user-specific and default)
   * Sorted by: isDefault (desc) → transaction count (desc) → name (asc)
   */
  async categories(_: unknown, __: unknown, context: GraphQLContext): Promise<Category[]> {
    // Ensure default categories exist
    await this.ensureDefaultCategories(context);
    const categories = await withPrismaErrorHandling(
      async () =>
        await context.prisma.category.findMany({
          where: {
            OR: [
              {userId: context.userId},
              {isDefault: true},
            ],
          },
          include: {
            _count: {
              select: {
                transactions: true,
              },
            },
          },
        }),
      {resource: 'Category', operation: 'read'},
    );

    // Sort: isDefault desc → transaction count desc → name asc
    categories.sort((a, b) => {
      // Default items first
      if (a.isDefault !== b.isDefault) {
        return b.isDefault ? 1 : -1;
      }
      // Then by transaction count (most used first)
      const countDiff = (b._count.transactions ?? 0) - (a._count.transactions ?? 0);
      if (countDiff !== 0) return countDiff;
      // Finally alphabetical
      return a.name.localeCompare(b.name);
    });

    // Map to return type without _count
    return categories.map((category) => {
      const {_count, ...categoryWithoutCount} = category;
      return categoryWithoutCount;
    });
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
    {input}: {input: {name: string; categoryType: 'Income' | 'Expense'}},
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
            categoryType: validatedInput.categoryType,
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
    {id, input}: {id: string; input: {name?: string; categoryType?: 'Income' | 'Expense'}},
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
            ...(validatedInput.categoryType !== undefined && {categoryType: validatedInput.categoryType}),
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

