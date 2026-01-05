/**
 * Budget Resolver
 * Handles budget GraphQL operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import type {GraphQLContext} from '../middleware/context';
import {z} from 'zod';
import {validate} from '../utils/validation';
import {NotFoundError, ValidationError} from '../utils/errors';
import {getBudgetNotifications, markNotificationRead} from '../services/NotificationService';
import {recalculateBudgetBalance} from '../services/BudgetService';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {validateContext} from '../utils/baseResolver';

const CreateBudgetInputSchema = z.object({
  amount: z.number().positive(),
  accountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  payeeId: z.string().uuid().nullable().optional(),
}).refine(
  (data) => {
    // Exactly one of accountId, categoryId, or payeeId must be set
    const count = [data.accountId, data.categoryId, data.payeeId].filter((id) => id !== null && id !== undefined).length;
    return count === 1;
  },
  {
    message: 'Exactly one of accountId, categoryId, or payeeId must be set',
  },
);

const UpdateBudgetInputSchema = z.object({
  amount: z.number().positive().optional(),
});

export class BudgetResolver {
  /**
   * Get all budgets for current user
   */
  async budgets(_: unknown, __: unknown, context: GraphQLContext) {
    validateContext(context);
    return await withPrismaErrorHandling(
      async () => {
        const budgets = await context.prisma.budget.findMany({
          where: {userId: context.userId},
          include: {
            account: true,
            category: true,
            payee: true,
          },
          orderBy: {createdAt: 'desc'},
        });

        return budgets;
      },
      {resource: 'Budget', operation: 'read'},
    );
  }

  /**
   * Get budget by ID
   */
  async budget(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    validateContext(context);
    return await withPrismaErrorHandling(
      async () => {
        const budget = await context.prisma.budget.findFirst({
          where: {
            id,
            userId: context.userId,
          },
          include: {
            account: true,
            category: true,
            payee: true,
          },
        });

        if (!budget) {
          throw new NotFoundError('Budget');
        }

        return budget;
      },
      {resource: 'Budget', operation: 'read'},
    );
  }

  /**
   * Get budget notifications for current user
   */
  async budgetNotifications(_: unknown, _args: unknown, context: GraphQLContext) {
    const notifications = await getBudgetNotifications(context.userId, false);

    // Include budget relation
    const notificationsWithBudget = await Promise.all(
      notifications.map(async (notification) => {
        const budget = await context.prisma.budget.findUnique({
          where: {id: notification.budgetId},
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
      }),
    );

    return notificationsWithBudget;
  }

  /**
   * Create a new budget
   */
  async createBudget(
    _: unknown,
    {input}: {input: unknown},
    context: GraphQLContext,
  ) {
    const validatedInput = validate(CreateBudgetInputSchema, input);

    // Verify the referenced entity belongs to user
    if (validatedInput.accountId) {
      const account = await context.prisma.account.findFirst({
        where: {
          id: validatedInput.accountId,
          userId: context.userId,
        },
      });
      if (!account) {
        throw new NotFoundError('Account');
      }
    }

    if (validatedInput.categoryId) {
      const category = await context.prisma.category.findFirst({
        where: {
          id: validatedInput.categoryId,
          OR: [
            {userId: context.userId},
            {isDefault: true},
          ],
        },
      });
      if (!category) {
        throw new NotFoundError('Category');
      }
    }

    if (validatedInput.payeeId) {
      const payee = await context.prisma.payee.findFirst({
        where: {
          id: validatedInput.payeeId,
          OR: [
            {userId: context.userId},
            {isDefault: true},
          ],
        },
      });
      if (!payee) {
        throw new NotFoundError('Payee');
      }
    }

    // Check if budget already exists
    const existingBudget = await context.prisma.budget.findFirst({
      where: {
        userId: context.userId,
        accountId: validatedInput.accountId ?? null,
        categoryId: validatedInput.categoryId ?? null,
        payeeId: validatedInput.payeeId ?? null,
      },
    });

    if (existingBudget) {
      throw new ValidationError('Budget already exists for this account/category/payee');
    }

    const budget = await context.prisma.budget.create({
      data: {
        userId: context.userId,
        amount: validatedInput.amount,
        accountId: validatedInput.accountId ?? null,
        categoryId: validatedInput.categoryId ?? null,
        payeeId: validatedInput.payeeId ?? null,
        lastResetDate: new Date(),
      },
      include: {
        account: true,
        category: true,
        payee: true,
      },
    });

    // Recalculate budget balance for current period
    await recalculateBudgetBalance(budget.id, context.userId, context.prisma);

    // Fetch updated budget with recalculated currentSpent
    const updatedBudget = await context.prisma.budget.findUnique({
      where: {id: budget.id},
      include: {
        account: true,
        category: true,
        payee: true,
      },
    });

    if (!updatedBudget) {
      throw new Error('Budget not found after creation');
    }

    return updatedBudget;
  }

  /**
   * Update budget
   */
  async updateBudget(
    _: unknown,
    {id, input}: {id: string; input: unknown},
    context: GraphQLContext,
  ) {
    const validatedInput = validate(UpdateBudgetInputSchema, input);

    // Verify budget belongs to user
    const budget = await context.prisma.budget.findFirst({
      where: {
        id,
        userId: context.userId,
      },
    });

    if (!budget) {
      throw new NotFoundError('Budget');
    }

    const updatedBudget = await context.prisma.budget.update({
      where: {id},
      data: {
        ...(validatedInput.amount !== undefined && {amount: validatedInput.amount}),
      },
      include: {
        account: true,
        category: true,
        payee: true,
      },
    });

    return updatedBudget;
  }

  /**
   * Delete budget
   */
  async deleteBudget(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    // Verify budget belongs to user
    const budget = await context.prisma.budget.findFirst({
      where: {
        id,
        userId: context.userId,
      },
    });

    if (!budget) {
      throw new NotFoundError('Budget');
    }

    await context.prisma.budget.delete({
      where: {id},
    });

    return true;
  }

  /**
   * Mark budget notification as read
   */
  async markBudgetNotificationRead(
    _: unknown,
    {id}: {id: string},
    context: GraphQLContext,
  ) {
    return await markNotificationRead(context.userId, id);
  }
}

