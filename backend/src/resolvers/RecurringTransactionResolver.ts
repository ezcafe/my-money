/**
 * Recurring Transaction Resolver
 * Handles recurring transaction-related GraphQL operations
 */


import type {GraphQLContext} from '../middleware/context';
import type {RecurringTransaction} from '@prisma/client';
import {NotFoundError} from '../utils/errors';
import {z} from 'zod';
import {validate} from '../utils/validation';
import cronValidator from 'cron-validator';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {validateContext} from '../utils/baseResolver';
import {BaseResolver} from './BaseResolver';

/**
 * Validate cron expression
 */
function isValidCronExpression(expr: string): boolean {
  try {
    return cronValidator.isValidCron(expr);
  } catch {
    return false;
  }
}

const CreateRecurringTransactionInputSchema = z.object({
  cronExpression: z
    .string()
    .min(1)
    .refine((expr) => isValidCronExpression(expr), {
      message: 'Invalid cron expression format',
    }),
  value: z.number().finite(),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional().nullable(),
  payeeId: z.string().uuid().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  nextRunDate: z.date(),
});

const UpdateRecurringTransactionInputSchema = z.object({
  cronExpression: z
    .string()
    .min(1)
    .refine((expr) => isValidCronExpression(expr), {
      message: 'Invalid cron expression format',
    })
    .optional(),
  value: z.number().finite().optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  payeeId: z.string().uuid().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  nextRunDate: z.date().optional(),
});

export class RecurringTransactionResolver extends BaseResolver {
  /**
   * Get all recurring transactions for current user
   */
  async recurringTransactions(_: unknown, __: unknown, context: GraphQLContext): Promise<RecurringTransaction[]> {
    validateContext(context);
    return await withPrismaErrorHandling(
      async () => {
        const recurringTransactions = await context.prisma.recurringTransaction.findMany({
          where: {
            account: {
              createdBy: context.userId,
            },
          },
          include: {
            account: true,
            category: true,
            payee: true,
          },
          orderBy: {nextRunDate: 'asc'},
        });

        // Map userId from account.createdBy since it's not in the RecurringTransaction model
        // but required by the GraphQL schema
        return recurringTransactions.map((rt) => ({
          ...rt,
          userId: rt.account.createdBy,
        })) as unknown as RecurringTransaction[];
      },
      {resource: 'RecurringTransaction', operation: 'read'},
    );
  }

  /**
   * Create a new recurring transaction
   */
  async createRecurringTransaction(
    _: unknown,
    {
      input,
    }: {
      input: {
        cronExpression: string;
        value: number;
        accountId: string;
        categoryId?: string | null;
        payeeId?: string | null;
        note?: string | null;
        nextRunDate: Date;
      };
    },
    context: GraphQLContext,
  ): Promise<RecurringTransaction> {
    const validatedInput = validate(CreateRecurringTransactionInputSchema, input);

    // Verify account belongs to user
    const account = await context.prisma.account.findFirst({
      where: {
        id: validatedInput.accountId,
        createdBy: context.userId,
      },
      select: {id: true, workspaceId: true},
    });

    if (!account) {
      throw new NotFoundError('Account');
    }

    const workspaceId = account.workspaceId;

    // Verify category if provided
    if (validatedInput.categoryId) {
      const category = await context.prisma.category.findFirst({
        where: {
          id: validatedInput.categoryId,
          workspaceId: workspaceId,
        },
        select: {id: true},
      });

      if (!category) {
        throw new NotFoundError('Category');
      }
    }

    // Verify payee if provided
    if (validatedInput.payeeId) {
      const payee = await context.prisma.payee.findFirst({
        where: {
          id: validatedInput.payeeId,
          workspaceId: workspaceId,
        },
        select: {id: true},
      });

      if (!payee) {
        throw new NotFoundError('Payee');
      }
    }

    const recurringTransaction = await context.prisma.recurringTransaction.create({
      data: {
        cronExpression: validatedInput.cronExpression,
        value: validatedInput.value,
        accountId: validatedInput.accountId,
        categoryId: validatedInput.categoryId ?? null,
        payeeId: validatedInput.payeeId ?? null,
        note: validatedInput.note ?? null,
        nextRunDate: validatedInput.nextRunDate,
      },
      include: {
        account: true,
        category: true,
        payee: true,
      },
    });

    // Map userId from account.createdBy since it's not in the RecurringTransaction model
    // but required by the GraphQL schema
    return {
      ...recurringTransaction,
      userId: recurringTransaction.account.createdBy,
    } as unknown as RecurringTransaction;
  }

  /**
   * Update recurring transaction
   */
  async updateRecurringTransaction(
    _: unknown,
    {
      id,
      input,
    }: {
      id: string;
      input: {
        cronExpression?: string;
        value?: number;
        accountId?: string;
        categoryId?: string | null;
        payeeId?: string | null;
        note?: string | null;
        nextRunDate?: Date;
      };
    },
    context: GraphQLContext,
  ): Promise<RecurringTransaction> {
    const validatedInput = validate(UpdateRecurringTransactionInputSchema, input);

    // Verify recurring transaction belongs to user
    const existing = await context.prisma.recurringTransaction.findFirst({
      where: {
        id,
        account: {
          createdBy: context.userId,
        },
      },
      select: {id: true},
    });

    if (!existing) {
      throw new NotFoundError('RecurringTransaction');
    }

    // Verify account if changed
    if (validatedInput.accountId) {
      const account = await context.prisma.account.findFirst({
        where: {
          id: validatedInput.accountId,
          createdBy: context.userId,
        },
        select: {id: true},
      });

      if (!account) {
        throw new NotFoundError('Account');
      }
    }

    const recurringTransaction = await context.prisma.recurringTransaction.update({
      where: {id},
      data: {
        ...(validatedInput.cronExpression !== undefined && {
          cronExpression: validatedInput.cronExpression,
        }),
        ...(validatedInput.value !== undefined && {value: validatedInput.value}),
        ...(validatedInput.accountId !== undefined && {accountId: validatedInput.accountId}),
        ...(validatedInput.categoryId !== undefined && {categoryId: validatedInput.categoryId}),
        ...(validatedInput.payeeId !== undefined && {payeeId: validatedInput.payeeId}),
        ...(validatedInput.note !== undefined && {note: validatedInput.note}),
        ...(validatedInput.nextRunDate !== undefined && {nextRunDate: validatedInput.nextRunDate}),
      },
      include: {
        account: true,
        category: true,
        payee: true,
      },
    });

    return recurringTransaction;
  }

  /**
   * Delete recurring transaction
   */
  async deleteRecurringTransaction(_: unknown, {id}: {id: string}, context: GraphQLContext): Promise<boolean> {
    const recurringTransaction = await context.prisma.recurringTransaction.findFirst({
      where: {
        id,
        account: {
          createdBy: context.userId,
        },
      },
      select: {id: true},
    });

    if (!recurringTransaction) {
      throw new NotFoundError('RecurringTransaction');
    }

    await context.prisma.recurringTransaction.delete({
      where: {id},
    });

    return true;
  }
}
