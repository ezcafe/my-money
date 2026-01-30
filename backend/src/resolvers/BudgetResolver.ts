/**
 * Budget Resolver
 * Handles budget GraphQL operations
 */

import type { GraphQLContext } from '../middleware/context';
import type { Budget, BudgetNotification } from '@prisma/client';
import { z } from 'zod';
import { validate } from '../utils/validation';
import { NotFoundError, ValidationError } from '../utils/errors';
import {
  getBudgetNotifications,
  markNotificationRead,
} from '../services/NotificationService';
import { recalculateBudgetBalance } from '../services/BudgetService';
import { withPrismaErrorHandling } from '../utils/prismaErrors';
import { validateContext } from '../utils/baseResolver';
import {
  checkWorkspaceAccess,
  getUserDefaultWorkspace,
} from '../services/WorkspaceService';
import { publishBudgetUpdate } from './SubscriptionResolver';
import { getContainer } from '../utils/container';

const CreateBudgetInputSchema = z
  .object({
    amount: z.number().positive(),
    accountId: z.string().uuid().nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    payeeId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (data) => {
      // Exactly one of accountId, categoryId, or payeeId must be set
      const count = [data.accountId, data.categoryId, data.payeeId].filter(
        (id) => id !== null && id !== undefined
      ).length;
      return count === 1;
    },
    {
      message: 'Exactly one of accountId, categoryId, or payeeId must be set',
    }
  );

const UpdateBudgetInputSchema = z.object({
  amount: z.number().positive().optional(),
  expectedVersion: z.number().int().optional(),
});

export class BudgetResolver {
  /**
   * Get all budgets for current workspace
   */
  async budgets(
    _: unknown,
    __: unknown,
    context: GraphQLContext
  ): Promise<Budget[]> {
    validateContext(context);

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

    const budgetRepository = getContainer().getBudgetRepository(context.prisma);
    return await withPrismaErrorHandling(
      async () => {
        const budgets = await budgetRepository.findMany(
          finalWorkspaceId,
          undefined,
          undefined,
          {
            account: true,
            category: true,
            payee: true,
          }
        );

        // Sort by createdAt desc
        budgets.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );

        return budgets;
      },
      { resource: 'Budget', operation: 'read' }
    );
  }

  /**
   * Get budget by ID
   */
  async budget(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<Budget> {
    validateContext(context);

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

    const budgetRepository = getContainer().getBudgetRepository(context.prisma);
    return await withPrismaErrorHandling(
      async () => {
        const budget = await budgetRepository.findById(
          id,
          finalWorkspaceId,
          undefined,
          {
            account: true,
            category: true,
            payee: true,
          }
        );

        if (!budget) {
          throw new NotFoundError('Budget');
        }

        return budget;
      },
      { resource: 'Budget', operation: 'read' }
    );
  }

  /**
   * Get budget notifications for current user
   */
  async budgetNotifications(
    _: unknown,
    _args: unknown,
    context: GraphQLContext
  ): Promise<Array<BudgetNotification & { budget: Budget | null }>> {
    const notifications = await getBudgetNotifications(context.userId, false);

    // Include budget relation
    const notificationsWithBudget = await Promise.all(
      notifications.map(async (notification) => {
        const budget = await context.prisma.budget.findUnique({
          where: { id: notification.budgetId },
          include: {
            account: true,
            category: true,
            payee: true,
          },
        });
        return {
          ...notification,
          budget,
        };
      })
    );

    return notificationsWithBudget;
  }

  /**
   * Create a new budget
   */
  async createBudget(
    _: unknown,
    { input }: { input: unknown },
    context: GraphQLContext
  ): Promise<Budget> {
    const validatedInput = validate(CreateBudgetInputSchema, input);

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

    const container = getContainer();
    const accountRepository = container.getAccountRepository(context.prisma);
    const categoryRepository = container.getCategoryRepository(context.prisma);
    const payeeRepository = container.getPayeeRepository(context.prisma);
    const budgetRepository = container.getBudgetRepository(context.prisma);

    // Verify the referenced entity belongs to workspace
    if (validatedInput.accountId) {
      const account = await accountRepository.findById(
        validatedInput.accountId,
        finalWorkspaceId,
        { id: true }
      );
      if (!account) {
        throw new NotFoundError('Account');
      }
    }

    if (validatedInput.categoryId) {
      const category = await categoryRepository.findById(
        validatedInput.categoryId,
        finalWorkspaceId,
        { id: true }
      );
      if (!category) {
        throw new NotFoundError('Category');
      }
    }

    if (validatedInput.payeeId) {
      const payee = await payeeRepository.findById(
        validatedInput.payeeId,
        finalWorkspaceId,
        { id: true }
      );
      if (!payee) {
        throw new NotFoundError('Payee');
      }
    }

    // Check if budget already exists
    const existingBudget = await budgetRepository.findFirst(
      {
        workspaceId: finalWorkspaceId,
        accountId: validatedInput.accountId ?? null,
        categoryId: validatedInput.categoryId ?? null,
        payeeId: validatedInput.payeeId ?? null,
      },
      { id: true }
    );

    if (existingBudget) {
      throw new ValidationError(
        'Budget already exists for this account/category/payee'
      );
    }

    const budget = await budgetRepository.create({
      workspaceId: finalWorkspaceId,
      amount: validatedInput.amount,
      accountId: validatedInput.accountId ?? null,
      categoryId: validatedInput.categoryId ?? null,
      payeeId: validatedInput.payeeId ?? null,
      createdBy: context.userId,
      lastEditedBy: context.userId,
    });

    // Recalculate budget balance for current period
    await recalculateBudgetBalance(budget.id, context.userId, context.prisma);

    // Fetch updated budget with recalculated currentSpent (use findById with include
    // so we get all scalar fields + relations; findUnique with select-only would
    // return a partial object and break GraphQL serialization)
    const updatedBudget = await budgetRepository.findById(
      budget.id,
      finalWorkspaceId,
      undefined,
      {
        account: true,
        category: true,
        payee: true,
      }
    );

    if (!updatedBudget) {
      throw new Error('Budget not found after creation');
    }

    // Publish update event
    publishBudgetUpdate(updatedBudget);

    return updatedBudget;
  }

  /**
   * Update budget
   */
  async updateBudget(
    _: unknown,
    { id, input }: { id: string; input: unknown },
    context: GraphQLContext
  ): Promise<Budget> {
    const validatedInput = validate(UpdateBudgetInputSchema, input);

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

    const budgetRepository = getContainer().getBudgetRepository(context.prisma);

    // Verify budget belongs to workspace
    const existingBudget = await budgetRepository.findById(id, finalWorkspaceId);

    if (!existingBudget) {
      throw new NotFoundError('Budget');
    }

    const versionService = getContainer().getVersionService(context.prisma);

    // Prepare new budget data
    const newBudgetData = {
      ...existingBudget,
      ...(validatedInput.amount !== undefined && {
        amount: validatedInput.amount,
      }),
      version: existingBudget.version + 1,
      lastEditedBy: context.userId,
    };

    // Check for conflicts (this will throw ConflictError if version mismatch)
    await versionService.checkForConflict(
      'Budget',
      id,
      existingBudget.version,
      validatedInput.expectedVersion,
      existingBudget as unknown as Record<string, unknown>,
      newBudgetData as unknown as Record<string, unknown>,
      finalWorkspaceId
    );

    // Update budget, create version snapshot
    await context.prisma.$transaction(async (tx) => {
      const txVersionService = getContainer().getVersionService(tx);

      // Create version snapshot before update (stores previous state)
      await txVersionService.createVersion(
        'Budget',
        id,
        existingBudget as unknown as Record<string, unknown>,
        newBudgetData as unknown as Record<string, unknown>,
        context.userId,
        tx
      );

      const txBudgetRepository = getContainer().getBudgetRepository(tx);
      await txBudgetRepository.update(id, {
        ...(validatedInput.amount !== undefined && {
          amount: validatedInput.amount,
        }),
      });

      // Increment version and update lastEditedBy
      await tx.budget.update({
        where: { id },
        data: {
          version: { increment: 1 },
          lastEditedBy: context.userId,
        },
      });
    });

    // Fetch updated budget
    const updatedBudget = await budgetRepository.findUnique(id, {
      account: true,
      category: true,
      payee: true,
    });

    if (!updatedBudget) {
      throw new NotFoundError('Budget');
    }

    // Publish update event
    publishBudgetUpdate(updatedBudget);

    return updatedBudget;
  }

  /**
   * Delete budget
   */
  async deleteBudget(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<boolean> {
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

    const budgetRepository = getContainer().getBudgetRepository(context.prisma);

    // Verify budget belongs to workspace
    const budget = await budgetRepository.findById(id, finalWorkspaceId);

    if (!budget) {
      throw new NotFoundError('Budget');
    }

    // Store budget for event before deletion
    const budgetToDelete = { ...budget };

    await budgetRepository.delete(id);

    // Publish delete event
    publishBudgetUpdate(budgetToDelete);

    return true;
  }

  /**
   * Mark budget notification as read
   */
  async markBudgetNotificationRead(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<boolean> {
    return await markNotificationRead(context.userId, id);
  }

  /**
   * Field resolver for versions
   */
  async versions(
    parent: Budget,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    const versionService = getContainer().getVersionService(context.prisma);
    return versionService.getEntityVersions('Budget', parent.id);
  }

  /**
   * Field resolver for createdBy
   */
  async createdBy(
    parent: Budget,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    return context.userLoader.load(parent.createdBy);
  }

  /**
   * Field resolver for lastEditedBy
   */
  async lastEditedBy(
    parent: Budget,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    return context.userLoader.load(parent.lastEditedBy);
  }
}
