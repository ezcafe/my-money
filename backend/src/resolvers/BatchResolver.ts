/**
 * Batch Resolver
 * Handles bulk create/update operations for better performance
 * Uses UnitOfWork pattern for atomic transactions
 */

import type { GraphQLContext } from '../middleware/context';
import type { Account, Category, Payee, Transaction } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';
import { withPrismaErrorHandling } from '../utils/prismaErrors';
import {
  checkWorkspaceAccess,
  getUserDefaultWorkspace,
} from '../services/WorkspaceService';
import { BaseResolver } from './BaseResolver';
import { UnitOfWork } from '../utils/UnitOfWork';
import { createTransaction } from '../services/TransactionService';
import * as postgresCache from '../utils/postgresCache';
import { CACHE_TAGS } from '../utils/cacheTags';
import {
  publishAccountUpdate,
  publishCategoryUpdate,
  publishPayeeUpdate,
  publishTransactionUpdate,
} from './SubscriptionResolver';
import { z } from 'zod';
import { validate } from '../utils/validation';
import { sanitizeUserInput } from '../utils/sanitization';

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  created: T[];
  updated: T[];
  errors: Array<{ index: number; message: string }>;
}

/**
 * Validation schemas for batch operations
 */
const BatchCreateAccountInputSchema = z.object({
  name: z.string().min(1).max(255),
  initBalance: z.number().finite().optional(),
  accountType: z
    .enum(['Cash', 'CreditCard', 'Bank', 'Saving', 'Loans'])
    .optional(),
  workspaceId: z.string().uuid().optional(),
});

const BatchUpdateAccountInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  initBalance: z.number().finite().optional(),
  accountType: z
    .enum(['Cash', 'CreditCard', 'Bank', 'Saving', 'Loans'])
    .optional(),
});

const BatchCreateCategoryInputSchema = z.object({
  name: z.string().min(1).max(255),
  categoryType: z.enum(['Income', 'Expense']),
  workspaceId: z.string().uuid().optional(),
});

const BatchUpdateCategoryInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  categoryType: z.enum(['Income', 'Expense']).optional(),
});

const BatchCreatePayeeInputSchema = z.object({
  name: z.string().min(1).max(255),
  workspaceId: z.string().uuid().optional(),
});

const BatchUpdatePayeeInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
});

const BatchCreateTransactionInputSchema = z.object({
  value: z.number().finite(),
  date: z.date().optional(),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional().nullable(),
  payeeId: z.string().uuid().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

const BatchUpdateTransactionInputSchema = z.object({
  id: z.string().uuid(),
  value: z.number().finite().optional(),
  date: z.date().optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  payeeId: z.string().uuid().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

/**
 * Batch Resolver
 * Provides bulk operations for accounts, categories, payees, and transactions
 */
export class BatchResolver extends BaseResolver {
  /**
   * Bulk create accounts
   * @param _ - Parent (unused)
   * @param args - GraphQL arguments
   * @param context - GraphQL context
   * @returns Batch result with created accounts and errors
   */
  async bulkCreateAccounts(
    _: unknown,
    { inputs }: { inputs: unknown[] },
    context: GraphQLContext
  ): Promise<BatchResult<Account>> {
    // Get workspace ID
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Validate all inputs
    const validatedInputs = inputs.map((input, index) => {
      try {
        return { index, data: validate(BatchCreateAccountInputSchema, input) };
      } catch (error) {
        throw new ValidationError(
          `Invalid input at index ${index}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    const result: BatchResult<Account> = {
      created: [],
      updated: [],
      errors: [],
    };

    // Use UnitOfWork for atomic operations
    await UnitOfWork.create(context.prisma, async (uow) => {
      const accountRepository = uow.getAccountRepository();

      for (const { index, data } of validatedInputs) {
        try {
          // Sanitize name
          const sanitizedName = sanitizeUserInput(data.name);

          // Create account
          const account = await withPrismaErrorHandling(
            async () => {
              return await accountRepository.create({
                name: sanitizedName,
                initBalance: data.initBalance ?? 0,
                accountType: data.accountType ?? 'Cash',
                workspaceId: data.workspaceId ?? workspaceId,
                createdBy: context.userId,
                lastEditedBy: context.userId,
                isDefault: false,
              });
            },
            { resource: 'Account', operation: 'create' }
          );

          result.created.push(account as unknown as Account);
          publishAccountUpdate(account as unknown as Account);
        } catch (error) {
          result.errors.push({
            index,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    // Invalidate cache for all accounts in workspace
    await postgresCache.invalidateByTags([CACHE_TAGS.ACCOUNTS(workspaceId)]);

    return result;
  }

  /**
   * Bulk update accounts
   * @param _ - Parent (unused)
   * @param args - GraphQL arguments
   * @param context - GraphQL context
   * @returns Batch result with updated accounts and errors
   */
  async bulkUpdateAccounts(
    _: unknown,
    { inputs }: { inputs: unknown[] },
    context: GraphQLContext
  ): Promise<BatchResult<Account>> {
    // Get workspace ID
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Validate all inputs
    const validatedInputs = inputs.map((input, index) => {
      try {
        return { index, data: validate(BatchUpdateAccountInputSchema, input) };
      } catch (error) {
        throw new ValidationError(
          `Invalid input at index ${index}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    const result: BatchResult<Account> = {
      created: [],
      updated: [],
      errors: [],
    };

    // Use UnitOfWork for atomic operations
    await UnitOfWork.create(context.prisma, async (uow) => {
      const accountRepository = uow.getAccountRepository();

      for (const { index, data } of validatedInputs) {
        try {
          // Verify account exists and belongs to workspace
          const existing = await accountRepository.findById(
            data.id,
            workspaceId,
            { id: true }
          );
          if (!existing) {
            throw new NotFoundError('Account');
          }

          // Prepare update data
          const updateData: {
            name?: string;
            initBalance?: number;
            accountType?: 'Cash' | 'CreditCard' | 'Bank' | 'Saving' | 'Loans';
            lastEditedBy?: string;
          } = {
            lastEditedBy: context.userId,
          };

          if (data.name !== undefined) {
            updateData.name = sanitizeUserInput(data.name);
          }
          if (data.initBalance !== undefined) {
            updateData.initBalance = data.initBalance;
          }
          if (data.accountType !== undefined) {
            updateData.accountType = data.accountType;
          }

          // Update account
          const account = await withPrismaErrorHandling(
            async () => {
              return await accountRepository.update(data.id, updateData);
            },
            { resource: 'Account', operation: 'update' }
          );

          result.updated.push(account as unknown as Account);
          publishAccountUpdate(account as unknown as Account);
        } catch (error) {
          result.errors.push({
            index,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    // Invalidate cache for all accounts in workspace
    await postgresCache.invalidateByTags([CACHE_TAGS.ACCOUNTS(workspaceId)]);

    return result;
  }

  /**
   * Bulk create categories
   * @param _ - Parent (unused)
   * @param args - GraphQL arguments
   * @param context - GraphQL context
   * @returns Batch result with created categories and errors
   */
  async bulkCreateCategories(
    _: unknown,
    { inputs }: { inputs: unknown[] },
    context: GraphQLContext
  ): Promise<BatchResult<Category>> {
    // Get workspace ID
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Validate all inputs
    const validatedInputs = inputs.map((input, index) => {
      try {
        return { index, data: validate(BatchCreateCategoryInputSchema, input) };
      } catch (error) {
        throw new ValidationError(
          `Invalid input at index ${index}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    const result: BatchResult<Category> = {
      created: [],
      updated: [],
      errors: [],
    };

    // Use UnitOfWork for atomic operations
    await UnitOfWork.create(context.prisma, async (uow) => {
      const categoryRepository = uow.getCategoryRepository();

      for (const { index, data } of validatedInputs) {
        try {
          // Sanitize name
          const sanitizedName = sanitizeUserInput(data.name);

          // Create category
          const category = await withPrismaErrorHandling(
            async () => {
              return await categoryRepository.create({
                name: sanitizedName,
                categoryType: data.categoryType,
                workspaceId: data.workspaceId ?? workspaceId,
                createdBy: context.userId,
                lastEditedBy: context.userId,
                isDefault: false,
              });
            },
            { resource: 'Category', operation: 'create' }
          );

          result.created.push(category as unknown as Category);
          publishCategoryUpdate(category as unknown as Category);
        } catch (error) {
          result.errors.push({
            index,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    return result;
  }

  /**
   * Bulk update categories
   * @param _ - Parent (unused)
   * @param args - GraphQL arguments
   * @param context - GraphQL context
   * @returns Batch result with updated categories and errors
   */
  async bulkUpdateCategories(
    _: unknown,
    { inputs }: { inputs: unknown[] },
    context: GraphQLContext
  ): Promise<BatchResult<Category>> {
    // Get workspace ID
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Validate all inputs
    const validatedInputs = inputs.map((input, index) => {
      try {
        return { index, data: validate(BatchUpdateCategoryInputSchema, input) };
      } catch (error) {
        throw new ValidationError(
          `Invalid input at index ${index}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    const result: BatchResult<Category> = {
      created: [],
      updated: [],
      errors: [],
    };

    // Use UnitOfWork for atomic operations
    await UnitOfWork.create(context.prisma, async (uow) => {
      const categoryRepository = uow.getCategoryRepository();

      for (const { index, data } of validatedInputs) {
        try {
          // Verify category exists and belongs to workspace
          const existing = await categoryRepository.findById(
            data.id,
            workspaceId,
            { id: true }
          );
          if (!existing) {
            throw new NotFoundError('Category');
          }

          // Prepare update data
          const updateData: {
            name?: string;
            categoryType?: 'Income' | 'Expense';
            lastEditedBy?: string;
          } = {
            lastEditedBy: context.userId,
          };

          if (data.name !== undefined) {
            updateData.name = sanitizeUserInput(data.name);
          }
          if (data.categoryType !== undefined) {
            updateData.categoryType = data.categoryType;
          }

          // Update category
          const category = await withPrismaErrorHandling(
            async () => {
              return await categoryRepository.update(data.id, updateData);
            },
            { resource: 'Category', operation: 'update' }
          );

          result.updated.push(category as unknown as Category);
          publishCategoryUpdate(category as unknown as Category);
        } catch (error) {
          result.errors.push({
            index,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    return result;
  }

  /**
   * Bulk create payees
   * @param _ - Parent (unused)
   * @param args - GraphQL arguments
   * @param context - GraphQL context
   * @returns Batch result with created payees and errors
   */
  async bulkCreatePayees(
    _: unknown,
    { inputs }: { inputs: unknown[] },
    context: GraphQLContext
  ): Promise<BatchResult<Payee>> {
    // Get workspace ID
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Validate all inputs
    const validatedInputs = inputs.map((input, index) => {
      try {
        return { index, data: validate(BatchCreatePayeeInputSchema, input) };
      } catch (error) {
        throw new ValidationError(
          `Invalid input at index ${index}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    const result: BatchResult<Payee> = {
      created: [],
      updated: [],
      errors: [],
    };

    // Use UnitOfWork for atomic operations
    await UnitOfWork.create(context.prisma, async (uow) => {
      const payeeRepository = uow.getPayeeRepository();

      for (const { index, data } of validatedInputs) {
        try {
          // Sanitize name
          const sanitizedName = sanitizeUserInput(data.name);

          // Create payee
          const payee = await withPrismaErrorHandling(
            async () => {
              return await payeeRepository.create({
                name: sanitizedName,
                workspaceId: data.workspaceId ?? workspaceId,
                createdBy: context.userId,
                lastEditedBy: context.userId,
                isDefault: false,
              });
            },
            { resource: 'Payee', operation: 'create' }
          );

          result.created.push(payee as unknown as Payee);
          publishPayeeUpdate(payee as unknown as Payee);
        } catch (error) {
          result.errors.push({
            index,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    return result;
  }

  /**
   * Bulk update payees
   * @param _ - Parent (unused)
   * @param args - GraphQL arguments
   * @param context - GraphQL context
   * @returns Batch result with updated payees and errors
   */
  async bulkUpdatePayees(
    _: unknown,
    { inputs }: { inputs: unknown[] },
    context: GraphQLContext
  ): Promise<BatchResult<Payee>> {
    // Get workspace ID
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Validate all inputs
    const validatedInputs = inputs.map((input, index) => {
      try {
        return { index, data: validate(BatchUpdatePayeeInputSchema, input) };
      } catch (error) {
        throw new ValidationError(
          `Invalid input at index ${index}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    const result: BatchResult<Payee> = {
      created: [],
      updated: [],
      errors: [],
    };

    // Use UnitOfWork for atomic operations
    await UnitOfWork.create(context.prisma, async (uow) => {
      const payeeRepository = uow.getPayeeRepository();

      for (const { index, data } of validatedInputs) {
        try {
          // Verify payee exists and belongs to workspace
          const existing = await payeeRepository.findById(
            data.id,
            workspaceId,
            { id: true }
          );
          if (!existing) {
            throw new NotFoundError('Payee');
          }

          // Prepare update data
          const updateData: {
            name?: string;
          } = {};

          if (data.name !== undefined) {
            updateData.name = sanitizeUserInput(data.name);
          }

          // Update payee
          const payee = await withPrismaErrorHandling(
            async () => {
              return await payeeRepository.update(data.id, updateData);
            },
            { resource: 'Payee', operation: 'update' }
          );

          result.updated.push(payee as unknown as Payee);
          publishPayeeUpdate(payee as unknown as Payee);
        } catch (error) {
          result.errors.push({
            index,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    return result;
  }

  /**
   * Bulk create transactions
   * @param _ - Parent (unused)
   * @param args - GraphQL arguments
   * @param context - GraphQL context
   * @returns Batch result with created transactions and errors
   */
  async bulkCreateTransactions(
    _: unknown,
    { inputs }: { inputs: unknown[] },
    context: GraphQLContext
  ): Promise<BatchResult<Transaction>> {
    // Get workspace ID
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Validate all inputs
    const validatedInputs = inputs.map((input, index) => {
      try {
        return {
          index,
          data: validate(BatchCreateTransactionInputSchema, input),
        };
      } catch (error) {
        throw new ValidationError(
          `Invalid input at index ${index}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    const result: BatchResult<Transaction> = {
      created: [],
      updated: [],
      errors: [],
    };

    // Use UnitOfWork for atomic operations
    await UnitOfWork.create(context.prisma, async (uow) => {
      const accountRepository = uow.getAccountRepository();

      // Verify all accounts exist and belong to workspace
      const accountIds = [
        ...new Set(validatedInputs.map((input) => input.data.accountId)),
      ];
      await Promise.all(
        accountIds.map(async (accountId) => {
          const account = await accountRepository.findById(
            accountId,
            workspaceId,
            { id: true }
          );
          if (!account) {
            throw new NotFoundError(`Account ${accountId}`);
          }
          return account;
        })
      );

      // Create transactions
      for (const { index, data } of validatedInputs) {
        try {
          const transaction = await withPrismaErrorHandling(
            async () => {
              return await createTransaction(
                {
                  value: data.value,
                  date: data.date,
                  accountId: data.accountId,
                  categoryId: data.categoryId ?? null,
                  payeeId: data.payeeId ?? null,
                  note: data.note ? sanitizeUserInput(data.note) : null,
                },
                context.userId,
                workspaceId,
                uow.getTransaction()
              );
            },
            { resource: 'Transaction', operation: 'create' }
          );

          result.created.push(transaction as unknown as Transaction);
          publishTransactionUpdate(transaction as unknown as Transaction);
        } catch (error) {
          result.errors.push({
            index,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    return result;
  }

  /**
   * Bulk update transactions
   * @param _ - Parent (unused)
   * @param args - GraphQL arguments
   * @param context - GraphQL context
   * @returns Batch result with updated transactions and errors
   */
  async bulkUpdateTransactions(
    _: unknown,
    { inputs }: { inputs: unknown[] },
    context: GraphQLContext
  ): Promise<BatchResult<Transaction>> {
    // Get workspace ID
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Validate all inputs
    const validatedInputs = inputs.map((input, index) => {
      try {
        return {
          index,
          data: validate(BatchUpdateTransactionInputSchema, input),
        };
      } catch (error) {
        throw new ValidationError(
          `Invalid input at index ${index}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    const result: BatchResult<Transaction> = {
      created: [],
      updated: [],
      errors: [],
    };

    // Use UnitOfWork for atomic operations
    await UnitOfWork.create(context.prisma, async (uow) => {
      const transactionRepository = uow.getTransactionRepository();
      const accountRepository = uow.getAccountRepository();

      for (const { index, data } of validatedInputs) {
        try {
          // Verify transaction exists and belongs to workspace
          const existing = await transactionRepository.findById(
            data.id,
            workspaceId,
            { id: true }
          );
          if (!existing) {
            throw new NotFoundError('Transaction');
          }

          // Verify account if provided
          if (data.accountId) {
            const account = await accountRepository.findById(
              data.accountId,
              workspaceId,
              { id: true }
            );
            if (!account) {
              throw new NotFoundError('Account');
            }
          }

          // Prepare update data
          const updateData: {
            value?: number;
            date?: Date;
            accountId?: string;
            categoryId?: string | null;
            payeeId?: string | null;
            note?: string | null;
            lastEditedBy?: string;
          } = {
            lastEditedBy: context.userId,
          };

          if (data.value !== undefined) {
            updateData.value = data.value;
          }
          if (data.date !== undefined) {
            updateData.date = data.date;
          }
          if (data.accountId !== undefined) {
            updateData.accountId = data.accountId;
          }
          if (data.categoryId !== undefined) {
            updateData.categoryId = data.categoryId;
          }
          if (data.payeeId !== undefined) {
            updateData.payeeId = data.payeeId;
          }
          if (data.note !== undefined) {
            updateData.note = data.note ? sanitizeUserInput(data.note) : null;
          }

          // Update transaction (using service layer for balance updates)
          // Note: For bulk updates, we use a simpler approach without balance recalculation
          // Full balance recalculation should be done separately if needed
          const transaction = await withPrismaErrorHandling(
            async () => {
              return await transactionRepository.update(data.id, updateData);
            },
            { resource: 'Transaction', operation: 'update' }
          );

          result.updated.push(transaction as unknown as Transaction);
          publishTransactionUpdate(transaction as unknown as Transaction);
        } catch (error) {
          result.errors.push({
            index,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    return result;
  }
}
