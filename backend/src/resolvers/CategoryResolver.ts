/**
 * Category Resolver
 * Handles category-related GraphQL operations
 */

 
import type {GraphQLContext} from '../middleware/context';
import {NotFoundError, ValidationError} from '../utils/errors';
import {z} from 'zod';
import {validate} from '../utils/validation';
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
   * Ensure default categories exist
   * Creates default categories if they don't exist
   */
  private async ensureDefaultCategories(context: GraphQLContext): Promise<void> {
    const defaultCategories = [
      {name: 'Default Expense Category', type: 'EXPENSE' as const},
      {name: 'Default Income Category', type: 'INCOME' as const},
    ];

    for (const categoryData of defaultCategories) {
      const existing = await context.prisma.category.findFirst({
        where: {
          name: categoryData.name,
          isDefault: true,
          userId: null,
        },
        select: {id: true},
      });

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
   * Get all categories (user-specific and default)
   */
  async categories(_: unknown, __: unknown, context: GraphQLContext) {
    // Ensure default categories exist
    await this.ensureDefaultCategories(context);
    const categories = await context.prisma.category.findMany({
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
    });

    return categories;
  }

  /**
   * Get category by ID
   */
  async category(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    const category = await context.prisma.category.findFirst({
      where: {
        id,
        OR: [
          {userId: context.userId},
          {isDefault: true},
        ],
      },
    });

    return category;
  }

  /**
   * Create a new category
   */
  async createCategory(
    _: unknown,
    {input}: {input: {name: string; type: 'INCOME' | 'EXPENSE'}},
    context: GraphQLContext,
  ) {
    const validatedInput = validate(CreateCategoryInputSchema, input);

    // Check if category with same name already exists for this user
    const existing = await context.prisma.category.findFirst({
      where: {
        name: validatedInput.name,
        userId: context.userId,
      },
      select: {id: true},
    });

    if (existing) {
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
  ) {
    const validatedInput = validate(UpdateCategoryInputSchema, input);

    // Verify category belongs to user (cannot update default categories)
    const existing = await context.prisma.category.findFirst({
      where: {
        id,
        userId: context.userId,
        isDefault: false,
      },
      select: {id: true, name: true},
    });

    if (!existing) {
      throw new NotFoundError('Category');
    }

    // Check name uniqueness if name is being updated
    if (validatedInput.name && validatedInput.name !== existing.name) {
      const duplicate = await context.prisma.category.findFirst({
        where: {
          name: validatedInput.name,
          userId: context.userId,
          id: {not: id},
        },
        select: {id: true},
      });

      if (duplicate) {
        throw new ValidationError('Category with this name already exists');
      }
    }

    const category = await context.prisma.category.update({
      where: {id},
      data: {
        ...(validatedInput.name !== undefined && {name: sanitizeUserInput(validatedInput.name)}),
        ...(validatedInput.type !== undefined && {type: validatedInput.type}),
      },
    });

    return category;
  }

  /**
   * Delete category (cannot delete default categories)
   */
  async deleteCategory(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    // Verify category belongs to user and is not default
    const category = await context.prisma.category.findFirst({
      where: {
        id,
        userId: context.userId,
        isDefault: false,
      },
      select: {id: true},
    });

    if (!category) {
      throw new NotFoundError('Category');
    }

    await context.prisma.category.delete({
      where: {id},
    });

    return true;
  }
}

