/**
 * Transaction Mutation Resolver
 * Handles all transaction-related GraphQL mutations
 */

import type { GraphQLContext } from '../../middleware/context';
import type { Transaction } from '@prisma/client';
import { NotFoundError } from '../../utils/errors';
import { z } from 'zod';
import { validate } from '../../utils/validation';
import { withPrismaErrorHandling } from '../../utils/prismaErrors';
import { incrementAccountBalance } from '../../services/AccountBalanceService';
import {
  createTransaction,
  updateTransactionWithBalance,
} from '../../services/TransactionService';
import { updateBudgetForTransaction } from '../../services/BudgetService';
import { BaseResolver } from '../BaseResolver';
import { invalidateAccountBalance } from '../../utils/cache';
import {
  checkWorkspaceAccess,
  getUserDefaultWorkspace,
} from '../../services/WorkspaceService';
import { publishTransactionUpdate } from '../SubscriptionResolver';
import { getContainer } from '../../utils/container';
import * as postgresCache from '../../utils/postgresCache';

const CreateTransactionInputSchema = z.object({
  value: z.number().finite(),
  date: z.date().optional(),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  payeeId: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
});

const UpdateTransactionInputSchema = z.object({
  value: z.number().finite().optional(),
  date: z.date().optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  payeeId: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
  expectedVersion: z.number().int().optional(),
});

/**
 * Transaction Mutation Resolver
 * Handles all transaction mutation operations
 */
export class TransactionMutationResolver extends BaseResolver {
  /**
   * Create a transaction
   * This is called when Add button is clicked in calculator
   * The value can be positive or negative
   */
  async createTransaction(
    _: unknown,
    { input }: { input: unknown },
    context: GraphQLContext
  ): Promise<Transaction> {
    // Validate input
    const validatedInput = validate(CreateTransactionInputSchema, input);

    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Verify account belongs to workspace
    const accountRepository = getContainer().getAccountRepository(
      context.prisma
    );
    const account = await accountRepository.findById(
      validatedInput.accountId,
      workspaceId,
      { id: true }
    );
    if (!account) {
      throw new NotFoundError('Account');
    }

    // Use service layer for business logic
    const transaction = await withPrismaErrorHandling(
      async () => {
        return await context.prisma.$transaction(async (tx) => {
          return await createTransaction(
            validatedInput,
            context.userId,
            workspaceId,
            tx
          );
        });
      },
      { resource: 'Transaction', operation: 'create' }
    );

    // Publish update event
    publishTransactionUpdate(transaction as unknown as Transaction);

    return transaction as unknown as Transaction;
  }

  /**
   * Update transaction
   */
  async updateTransaction(
    _: unknown,
    { id, input }: { id: string; input: unknown },
    context: GraphQLContext
  ): Promise<Transaction> {
    // Validate input
    const validatedInput = validate(UpdateTransactionInputSchema, input);

    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access
    await checkWorkspaceAccess(workspaceId, context.userId);

    const transactionRepository = getContainer().getTransactionRepository(
      context.prisma
    );
    const categoryRepository = getContainer().getCategoryRepository(
      context.prisma
    );
    const accountRepository = getContainer().getAccountRepository(
      context.prisma
    );

    // Verify transaction belongs to workspace and fetch with category
    const existingTransactionRaw = await transactionRepository.findById(
      id,
      workspaceId,
      undefined,
      {
        category: true,
      }
    );

    if (!existingTransactionRaw) {
      throw new NotFoundError('Transaction');
    }

    // Type assertion for transaction with category relation
    const existingTransaction =
      existingTransactionRaw as typeof existingTransactionRaw & {
        category: { categoryType: 'Income' | 'Expense' } | null;
        version: number;
      };

    // Store old transaction for version tracking (if needed in future)
    // const oldTransaction = {...existingTransaction};
    const versionService = getContainer().getVersionService(context.prisma);

    // Prepare new transaction data
    const newTransactionData = {
      ...existingTransaction,
      ...(validatedInput.value !== undefined && {
        value: validatedInput.value,
      }),
      ...(validatedInput.date !== undefined && { date: validatedInput.date }),
      ...(validatedInput.accountId !== undefined && {
        accountId: validatedInput.accountId,
      }),
      ...(validatedInput.categoryId !== undefined && {
        categoryId: validatedInput.categoryId,
      }),
      ...(validatedInput.payeeId !== undefined && {
        payeeId: validatedInput.payeeId,
      }),
      ...(validatedInput.note !== undefined && { note: validatedInput.note }),
      version: existingTransaction.version + 1,
      lastEditedBy: context.userId,
    };

    // Check for conflicts (this will throw ConflictError if version mismatch)
    await versionService.checkForConflict(
      'Transaction',
      id,
      existingTransaction.version,
      validatedInput.expectedVersion,
      existingTransaction as unknown as Record<string, unknown>,
      newTransactionData as unknown as Record<string, unknown>,
      workspaceId
    );

    // Verify account if changed
    if (validatedInput.accountId) {
      const account = await accountRepository.findById(
        validatedInput.accountId,
        workspaceId,
        { id: true }
      );

      if (!account) {
        throw new NotFoundError('Account');
      }
    }

    // Verify and fetch new category if changed
    let newCategory: { categoryType: 'Income' | 'Expense' } | null = null;
    if (validatedInput.categoryId !== undefined) {
      if (validatedInput.categoryId) {
        const foundCategory = await categoryRepository.findById(
          validatedInput.categoryId,
          workspaceId,
          { id: true, categoryType: true }
        );

        if (!foundCategory) {
          throw new NotFoundError('Category');
        }

        newCategory = foundCategory;
      }
    } else {
      // Category not changed, use existing
      newCategory = existingTransaction.category;
    }

    // Use service layer for complex business logic with version tracking
    const transaction = await context.prisma.$transaction(async (tx) => {
      const txVersionService = getContainer().getVersionService(tx);

      // Create version snapshot before update (stores previous state)
      await txVersionService.createVersion(
        'Transaction',
        id,
        existingTransaction as unknown as Record<string, unknown>,
        newTransactionData as unknown as Record<string, unknown>,
        context.userId,
        tx
      );

      const updatedTransaction = await updateTransactionWithBalance(
        id,
        validatedInput,
        {
          value: Number(existingTransaction.value),
          accountId: existingTransaction.accountId,
          categoryId: existingTransaction.categoryId,
          category: existingTransaction.category,
          date: existingTransaction.date,
        },
        newCategory,
        context.userId,
        workspaceId,
        tx
      );

      // Increment version and update lastEditedBy
      await tx.transaction.update({
        where: { id },
        data: {
          version: { increment: 1 },
          lastEditedBy: context.userId,
        },
      });

      return updatedTransaction;
    });

    // Publish update event
    publishTransactionUpdate(transaction as unknown as Transaction);

    return transaction as unknown as Transaction;
  }

  /**
   * Delete transaction
   */
  async deleteTransaction(
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

    const transactionRepository = getContainer().getTransactionRepository(
      context.prisma
    );

    // Verify transaction belongs to workspace and fetch with category
    const transactionRaw = await transactionRepository.findById(
      id,
      workspaceId,
      undefined,
      {
        category: true,
      }
    );

    if (!transactionRaw) {
      throw new NotFoundError('Transaction');
    }

    // Type assertion for transaction with category relation
    const transaction = transactionRaw as typeof transactionRaw & {
      category: { categoryType: 'Income' | 'Expense' } | null;
    };

    // Calculate balance delta to reverse based on category type
    const transactionValue = Number(transaction.value);
    const balanceDelta =
      transaction.category?.categoryType === 'Income'
        ? -transactionValue // Reverse income: subtract
        : transactionValue; // Reverse expense: add back

    // Delete transaction and update account balance atomically
    await context.prisma.$transaction(async (tx) => {
      const txTransactionRepository =
        getContainer().getTransactionRepository(tx);

      // Get account to find workspaceId for budget updates
      const account = await tx.account.findUnique({
        where: { id: transaction.accountId },
        select: { workspaceId: true },
      });

      // Update budgets before deleting (need transaction data)
      if (account) {
        await updateBudgetForTransaction(
          {
            id: transaction.id,
            accountId: transaction.accountId,
            categoryId: transaction.categoryId,
            payeeId: transaction.payeeId,
            userId: context.userId,
            workspaceId: account.workspaceId,
            value: Number(transaction.value),
            date: transaction.date,
            categoryType: transaction.category?.categoryType ?? null,
          },
          'delete',
          undefined,
          tx
        );
      }

      // Delete transaction
      await txTransactionRepository.delete(id, tx);

      // Reverse the balance change
      await incrementAccountBalance(transaction.accountId, balanceDelta, tx);
    });

    // Invalidate caches after transaction deletion
    await Promise.all([
      invalidateAccountBalance(transaction.accountId).catch(() => {}),
      postgresCache.invalidateUserCache(context.userId).catch(() => {}),
    ]);

    // Publish delete event
    publishTransactionUpdate(transaction as unknown as Transaction);

    return true;
  }
}
