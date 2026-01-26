/**
 * Category Resolver
 * Handles category-related GraphQL operations
 */

import type { GraphQLContext } from '../middleware/context';
import type { Category } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';
import { z } from 'zod';
import { withPrismaErrorHandling } from '../utils/prismaErrors';
import { sanitizeUserInput } from '../utils/sanitization';
import { BaseResolver } from './BaseResolver';
import { categoryEventEmitter } from '../events';
import {
  checkWorkspaceAccess,
  getUserDefaultWorkspace,
} from '../services/WorkspaceService';
import { publishCategoryUpdate } from './SubscriptionResolver';
import { getContainer } from '../utils/container';

const CreateCategoryInputSchema = z.object({
  name: z.string().min(1).max(255),
  categoryType: z.enum(['Income', 'Expense']),
  workspaceId: z.string().uuid().optional(),
});

const UpdateCategoryInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  categoryType: z.enum(['Income', 'Expense']).optional(),
  expectedVersion: z.number().int().optional(),
});

export class CategoryResolver extends BaseResolver {
  /**
   * Get all categories for the current workspace
   * Sorted by: isDefault (desc) → transaction count (desc) → name (asc)
   */
  async categories(
    _: unknown,
    __: unknown,
    context: GraphQLContext
  ): Promise<Category[]> {
    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access - fallback to default workspace if current workspace doesn't exist
    let finalWorkspaceId = workspaceId;
    try {
      await checkWorkspaceAccess(workspaceId, context.userId);
    } catch (error) {
      // If workspace doesn't exist, fall back to user's default workspace
      if (error instanceof NotFoundError && error.message.includes('Workspace')) {
        finalWorkspaceId = await getUserDefaultWorkspace(context.userId);
        await checkWorkspaceAccess(finalWorkspaceId, context.userId);
        // Update context so subsequent operations use the correct workspace
        context.currentWorkspaceId = finalWorkspaceId;
      } else {
        throw error;
      }
    }

    // Ensure default categories exist before querying
    await this.ensureDefaultCategories(context, finalWorkspaceId);

    const categoryRepository = getContainer().getCategoryRepository(
      context.prisma
    );
    const categories = await withPrismaErrorHandling(
      async () => {
        const categoriesList = await categoryRepository.findMany(finalWorkspaceId);
        // Get transaction counts for each category
        const categoriesWithCounts = await Promise.all(
          categoriesList.map(async (category) => {
            const count = await context.prisma.transaction.count({
              where: { categoryId: category.id },
            });
            return { ...category, _count: { transactions: count } };
          })
        );
        return categoriesWithCounts;
      },
      { resource: 'Category', operation: 'read' }
    );

    // Sort: isDefault desc → transaction count desc → name asc
    categories.sort((a, b) => {
      // Default items first
      if (a.isDefault !== b.isDefault) {
        return b.isDefault ? 1 : -1;
      }
      // Then by transaction count (most used first)
      const countDiff =
        (b._count?.transactions ?? 0) - (a._count?.transactions ?? 0);
      if (countDiff !== 0) return countDiff;
      // Finally alphabetical
      return a.name.localeCompare(b.name);
    });

    // Map to return type without _count
    return categories.map((category) => {
      const { _count, ...categoryWithoutCount } = category;
      return categoryWithoutCount;
    });
  }

  /**
   * Get category by ID
   */
  async category(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<Category | null> {
    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access - fallback to default workspace if current workspace doesn't exist
    let finalWorkspaceId = workspaceId;
    try {
      await checkWorkspaceAccess(workspaceId, context.userId);
    } catch (error) {
      // If workspace doesn't exist, fall back to user's default workspace
      if (error instanceof NotFoundError && error.message.includes('Workspace')) {
        finalWorkspaceId = await getUserDefaultWorkspace(context.userId);
        await checkWorkspaceAccess(finalWorkspaceId, context.userId);
        // Update context so subsequent operations use the correct workspace
        context.currentWorkspaceId = finalWorkspaceId;
      } else {
        throw error;
      }
    }

    const categoryRepository = getContainer().getCategoryRepository(
      context.prisma
    );
    return await categoryRepository.findById(id, finalWorkspaceId);
  }

  /**
   * Create a new category
   */
  async createCategory(
    _: unknown,
    {
      input,
    }: {
      input: {
        name: string;
        categoryType: 'Income' | 'Expense';
        workspaceId?: string;
      };
    },
    context: GraphQLContext
  ): Promise<Category> {
    const validatedInput = this.validateInput(CreateCategoryInputSchema, input);

    // Get workspace ID from input or context (default to user's default workspace)
    const workspaceId =
      validatedInput.workspaceId ??
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access - fallback to default workspace if current workspace doesn't exist
    let finalWorkspaceId = workspaceId;
    try {
      await checkWorkspaceAccess(workspaceId, context.userId);
    } catch (error) {
      // If workspace doesn't exist, fall back to user's default workspace
      if (error instanceof NotFoundError && error.message.includes('Workspace')) {
        finalWorkspaceId = await getUserDefaultWorkspace(context.userId);
        await checkWorkspaceAccess(finalWorkspaceId, context.userId);
        // Update context so subsequent operations use the correct workspace
        context.currentWorkspaceId = finalWorkspaceId;
      } else {
        throw error;
      }
    }

    const categoryRepository = getContainer().getCategoryRepository(
      context.prisma
    );

    // Check if category with same name already exists in this workspace
    const existingCategory = await categoryRepository.findMany(finalWorkspaceId);
    const nameExists = existingCategory.some(
      (cat) => cat.name === validatedInput.name
    );

    if (nameExists) {
      throw new ValidationError('Category with this name already exists');
    }

    const category = await withPrismaErrorHandling(
      async () =>
        await categoryRepository.create({
          name: sanitizeUserInput(validatedInput.name),
          categoryType: validatedInput.categoryType,
          isDefault: false,
          workspaceId: finalWorkspaceId,
          createdBy: context.userId,
          lastEditedBy: context.userId,
        }),
      { resource: 'Category', operation: 'create' }
    );

    // Emit event after category creation
    categoryEventEmitter.emit('category.created', category);
    publishCategoryUpdate(category);

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(
    _: unknown,
    {
      id,
      input,
    }: {
      id: string;
      input: {
        name?: string;
        categoryType?: 'Income' | 'Expense';
        expectedVersion?: number;
      };
    },
    context: GraphQLContext
  ): Promise<Category> {
    const validatedInput = this.validateInput(UpdateCategoryInputSchema, input);

    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access - fallback to default workspace if current workspace doesn't exist
    let finalWorkspaceId = workspaceId;
    try {
      await checkWorkspaceAccess(workspaceId, context.userId);
    } catch (error) {
      // If workspace doesn't exist, fall back to user's default workspace
      if (error instanceof NotFoundError && error.message.includes('Workspace')) {
        finalWorkspaceId = await getUserDefaultWorkspace(context.userId);
        await checkWorkspaceAccess(finalWorkspaceId, context.userId);
        // Update context so subsequent operations use the correct workspace
        context.currentWorkspaceId = finalWorkspaceId;
      } else {
        throw error;
      }
    }

    // Verify category belongs to workspace
    const categoryRepository = getContainer().getCategoryRepository(
      context.prisma
    );
    const existingCategory = await categoryRepository.findById(id, finalWorkspaceId);

    if (!existingCategory) {
      throw new NotFoundError('Category');
    }

    // Store old category for event and version tracking
    const oldCategory = { ...existingCategory };
    const versionService = getContainer().getVersionService(context.prisma);

    // Prepare new category data
    const newCategoryData = {
      ...existingCategory,
      ...(validatedInput.name !== undefined && {
        name: sanitizeUserInput(validatedInput.name),
      }),
      ...(validatedInput.categoryType !== undefined && {
        categoryType: validatedInput.categoryType,
      }),
      version: existingCategory.version + 1,
      lastEditedBy: context.userId,
    };

    // Check for conflicts (this will throw ConflictError if version mismatch)
    await versionService.checkForConflict(
      'Category',
      id,
      existingCategory.version,
      validatedInput.expectedVersion,
      existingCategory as unknown as Record<string, unknown>,
      newCategoryData as unknown as Record<string, unknown>,
      finalWorkspaceId
    );

    // Check name uniqueness if name is being updated
    if (validatedInput.name && validatedInput.name !== existingCategory.name) {
      const existingCategories = await categoryRepository.findMany(finalWorkspaceId);
      const nameExists = existingCategories.some(
        (cat) => cat.id !== id && cat.name === validatedInput.name
      );

      if (nameExists) {
        throw new ValidationError('Category with this name already exists');
      }
    }

    // Update category, create version snapshot
    await context.prisma.$transaction(async (tx) => {
      const txVersionService = getContainer().getVersionService(tx);

      // Create version snapshot before update (stores previous state)
      await txVersionService.createVersion(
        'Category',
        id,
        existingCategory as unknown as Record<string, unknown>,
        newCategoryData as unknown as Record<string, unknown>,
        context.userId,
        tx
      );

      const txCategoryRepository = getContainer().getCategoryRepository(tx);
      await txCategoryRepository.update(id, {
        ...(validatedInput.name !== undefined && {
          name: sanitizeUserInput(validatedInput.name),
        }),
        ...(validatedInput.categoryType !== undefined && {
          categoryType: validatedInput.categoryType,
        }),
      });

      // Increment version and update lastEditedBy
      await tx.category.update({
        where: { id },
        data: {
          version: { increment: 1 },
          lastEditedBy: context.userId,
        },
      });
    });

    // Fetch updated category
    const updatedCategory = await categoryRepository.findById(id, finalWorkspaceId);

    if (!updatedCategory) {
      throw new NotFoundError('Category');
    }

    // Emit event after category update
    categoryEventEmitter.emit('category.updated', oldCategory, updatedCategory);
    publishCategoryUpdate(updatedCategory);

    return updatedCategory;
  }

  /**
   * Delete category (cannot delete default categories)
   */
  async deleteCategory(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<boolean> {
    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Verify category belongs to workspace
    const categoryRepository = getContainer().getCategoryRepository(
      context.prisma
    );
    const category = await categoryRepository.findById(id, workspaceId);

    if (!category) {
      throw new NotFoundError('Category');
    }

    // Store category for event before deletion
    const categoryToDelete = { ...category };

    await categoryRepository.delete(id);

    // Emit event after category deletion
    categoryEventEmitter.emit('category.deleted', categoryToDelete);
    publishCategoryUpdate(categoryToDelete);

    return true;
  }

  /**
   * Field resolver for versions
   */
  async versions(
    parent: Category,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    const versionService = getContainer().getVersionService(context.prisma);
    return versionService.getEntityVersions('Category', parent.id);
  }

  /**
   * Field resolver for createdBy
   */
  async createdBy(
    parent: Category,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    return context.userLoader.load(parent.createdBy);
  }

  /**
   * Field resolver for lastEditedBy
   */
  async lastEditedBy(
    parent: Category,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    return context.userLoader.load(parent.lastEditedBy);
  }
}
