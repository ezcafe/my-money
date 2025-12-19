/**
 * Recurring Transaction Resolver
 * Handles recurring transaction-related GraphQL operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type {GraphQLContext} from '../middleware/context';
import {NotFoundError} from '../utils/errors';
import {z} from 'zod';
import {validate} from '../utils/validation';
import cronValidator from 'cron-validator';

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

export class RecurringTransactionResolver {
  /**
   * Get all recurring transactions for current user
   */
  async recurringTransactions(_: unknown, __: unknown, context: GraphQLContext) {
    const recurringTransactions = await context.prisma.recurringTransaction.findMany({
      where: {userId: context.userId},
      include: {
        account: true,
        category: true,
        payee: true,
      },
      orderBy: {nextRunDate: 'asc'},
    });

    return recurringTransactions;
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
  ) {
    const validatedInput = validate(CreateRecurringTransactionInputSchema, input);

    // Verify account belongs to user
    const account = await context.prisma.account.findFirst({
      where: {
        id: validatedInput.accountId,
        userId: context.userId,
      },
    });

    if (!account) {
      throw new NotFoundError('Account');
    }

    // Verify category if provided
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

    // Verify payee if provided
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

    const recurringTransaction = await context.prisma.recurringTransaction.create({
      data: {
        cronExpression: validatedInput.cronExpression,
        value: validatedInput.value,
        accountId: validatedInput.accountId,
        categoryId: validatedInput.categoryId ?? null,
        payeeId: validatedInput.payeeId ?? null,
        note: validatedInput.note ?? null,
        nextRunDate: validatedInput.nextRunDate,
        userId: context.userId,
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
  ) {
    const validatedInput = validate(UpdateRecurringTransactionInputSchema, input);

    // Verify recurring transaction belongs to user
    const existing = await context.prisma.recurringTransaction.findFirst({
      where: {
        id,
        userId: context.userId,
      },
    });

    if (!existing) {
      throw new NotFoundError('RecurringTransaction');
    }

    // Verify account if changed
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
  async deleteRecurringTransaction(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    const recurringTransaction = await context.prisma.recurringTransaction.findFirst({
      where: {
        id,
        userId: context.userId,
      },
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

