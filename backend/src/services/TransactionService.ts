/**
 * Transaction Service
 * Handles complex transaction business logic
 * Extracted from TransactionResolver to improve separation of concerns
 */

import type { PrismaClient } from '@prisma/client';
import { AccountBalanceService } from './AccountBalanceService';
import { updateBudgetForTransaction } from './BudgetService';
import { transactionEventEmitter } from '../events';
import { sanitizeUserInput } from '../utils/sanitization';
import { NotFoundError } from '../utils/errors';
import * as postgresCache from '../utils/postgresCache';
import { invalidateAccountBalance } from '../utils/cache';
import { getContainer } from '../utils/container';
import { prisma } from '../utils/prisma';

type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Transaction Service Class
 * Provides business logic methods for transaction operations
 * Uses repository pattern for data access
 */
export class TransactionService {
  private readonly client: PrismaTransaction | PrismaClient;

  /**
   * Constructor
   * @param prismaClient - Prisma client instance (injected dependency)
   */
  constructor(prismaClient: PrismaTransaction | PrismaClient) {
    this.client = prismaClient;
  }

  /**
   * Create a new transaction with balance and budget updates
   * Handles complex business logic for creating transactions including:
   * - Category type verification
   * - Balance delta calculations based on category types
   * - Account balance updates
   * - Budget updates
   * @param validatedInput - Validated input data
   * @param userId - User ID
   * @param workspaceId - Workspace ID
   * @param tx - Optional Prisma transaction client
   * @returns Created transaction with relations
   */
  async createTransaction(
    validatedInput: {
      value: number;
      date?: Date;
      accountId: string;
      categoryId?: string | null;
      payeeId?: string | null;
      note?: string | null;
    },
    userId: string,
    workspaceId: string,
    tx?: PrismaTransaction | PrismaClient
  ): Promise<{
    id: string;
    value: number | string;
    date: Date;
    accountId: string;
    categoryId: string | null;
    payeeId: string | null;
    note: string | null;
    userId: string;
    account: unknown;
    category: unknown;
    payee: unknown;
  }> {
    const client = tx ?? this.client;
    const container = getContainer();
    const transactionRepository = container.getTransactionRepository(client);
    const categoryRepository = container.getCategoryRepository(client);
    const payeeRepository = container.getPayeeRepository(client);
    const accountRepository = container.getAccountRepository(client);
    const accountBalanceService = new AccountBalanceService(client);

    // Verify account belongs to workspace
    const account = await accountRepository.findById(
      validatedInput.accountId,
      workspaceId,
      { id: true }
    );
    if (!account) {
      throw new NotFoundError('Account');
    }

    // Verify category and payee in parallel if both are provided
    let category: { categoryType: 'Income' | 'Expense' } | null = null;

    const [foundCategory, foundPayee] = await Promise.all([
      validatedInput.categoryId
        ? categoryRepository.findById(validatedInput.categoryId, workspaceId, {
            id: true,
            categoryType: true,
          })
        : Promise.resolve(null),
      validatedInput.payeeId
        ? payeeRepository.findById(validatedInput.payeeId, workspaceId, {
            id: true,
          })
        : Promise.resolve(null),
    ]);

    if (validatedInput.categoryId && !foundCategory) {
      throw new NotFoundError('Category');
    }
    category = foundCategory;

    if (validatedInput.payeeId && !foundPayee) {
      throw new NotFoundError('Payee');
    }

    // Calculate balance delta based on category type
    // Income categories add money, Expense categories (or no category) subtract money
    const balanceDelta =
      category?.categoryType === 'Income'
        ? validatedInput.value
        : -validatedInput.value;

    // Create transaction
    const newTransaction = await transactionRepository.create({
      value: validatedInput.value,
      date: validatedInput.date ?? new Date(),
      accountId: validatedInput.accountId,
      categoryId: validatedInput.categoryId,
      payeeId: validatedInput.payeeId,
      note: validatedInput.note ? sanitizeUserInput(validatedInput.note) : null,
      createdBy: userId,
      lastEditedBy: userId,
    });

    // Update account balance incrementally based on category type
    await accountBalanceService.incrementAccountBalance(
      validatedInput.accountId,
      balanceDelta,
      tx
    );

    // Return transaction with relations
    const transactionWithRelations = await transactionRepository.findById(
      newTransaction.id,
      workspaceId,
      undefined,
      {
        account: true,
        category: true,
        payee: true,
      }
    );

    if (!transactionWithRelations) {
      throw new Error('Transaction not found after creation');
    }

    // Update budgets for this transaction
    await updateBudgetForTransaction(
      {
        id: transactionWithRelations.id,
        accountId: transactionWithRelations.accountId,
        categoryId: transactionWithRelations.categoryId,
        payeeId: transactionWithRelations.payeeId,
        userId: transactionWithRelations.createdBy,
        workspaceId,
        value: Number(transactionWithRelations.value),
        date: transactionWithRelations.date,
        categoryType: category?.categoryType ?? null,
      },
      'create',
      undefined,
      tx
    );

    const result = {
      ...transactionWithRelations,
      value: Number(transactionWithRelations.value),
    } as unknown as {
      id: string;
      value: number | string;
      date: Date;
      accountId: string;
      categoryId: string | null;
      payeeId: string | null;
      note: string | null;
      userId: string;
      account: unknown;
      category: unknown;
      payee: unknown;
    };

    // Emit event after transaction creation (for additional side effects)
    // Note: Balance and budget updates are done synchronously above for data integrity
    transactionEventEmitter.emit(
      'transaction.created',
      transactionWithRelations
    );

    // Invalidate caches after transaction creation (only if not in transaction)
    // If in transaction, cache will be invalidated after transaction commits
    if (!tx) {
      await Promise.all([
        invalidateAccountBalance(validatedInput.accountId).catch(() => {}),
        postgresCache.invalidateUserCache(userId).catch(() => {}),
      ]);
    }

    return result;
  }

  /**
   * Update transaction with balance adjustment logic
   * Handles complex business logic for updating transactions including:
   * - Balance delta calculations based on category types
   * - Account balance adjustments when transaction changes
   * - Budget updates
   * @param transactionId - Transaction ID to update
   * @param validatedInput - Validated input data
   * @param existingTransaction - Existing transaction with category
   * @param newCategory - New category (if changed) or existing category
   * @param userId - User ID
   * @param workspaceId - Workspace ID
   * @param tx - Optional Prisma transaction client
   * @returns Updated transaction with relations
   */
  async updateTransactionWithBalance(
    transactionId: string,
    validatedInput: {
      value?: number;
      date?: Date;
      accountId?: string;
      categoryId?: string | null;
      payeeId?: string | null;
      note?: string | null;
    },
    existingTransaction: {
      value: number;
      accountId: string;
      categoryId: string | null;
      category: { categoryType: 'Income' | 'Expense' } | null;
      date: Date;
    },
    newCategory: { categoryType: 'Income' | 'Expense' } | null,
    userId: string,
    workspaceId: string,
    tx?: PrismaTransaction | PrismaClient
  ): Promise<{
    id: string;
    value: number | string;
    date: Date;
    accountId: string;
    categoryId: string | null;
    payeeId: string | null;
    note: string | null;
    userId: string;
    account: unknown;
    category: unknown;
    payee: unknown;
  }> {
    const client = tx ?? this.client;
    const container = getContainer();
    const transactionRepository = container.getTransactionRepository(client);
    const accountBalanceService = new AccountBalanceService(client);

    // Calculate old balance delta based on old category type
    const oldCategory = existingTransaction.category;
    const oldValue = Number(existingTransaction.value);
    const oldBalanceDelta =
      oldCategory?.categoryType === 'Income' ? oldValue : -oldValue;

    const newValue = validatedInput.value ?? oldValue;
    const oldAccountId = existingTransaction.accountId;
    const newAccountId = validatedInput.accountId ?? oldAccountId;

    // Calculate new balance delta based on new category type
    const newBalanceDelta =
      newCategory?.categoryType === 'Income' ? newValue : -newValue;

    // Update transaction
    const updatedTransaction = await transactionRepository.update(
      transactionId,
      {
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
        ...(validatedInput.note !== undefined && {
          note: validatedInput.note
            ? sanitizeUserInput(validatedInput.note)
            : null,
        }),
      }
    );

    // Adjust account balances
    // Need to reverse old balance change and apply new balance change
    const needsBalanceUpdate =
      validatedInput.value !== undefined ||
      validatedInput.accountId !== undefined ||
      validatedInput.categoryId !== undefined;

    if (needsBalanceUpdate) {
      if (oldAccountId === newAccountId) {
        // Same account: reverse old balance change and apply new balance change
        // Formula: -oldBalanceDelta + newBalanceDelta works for both cases:
        // - Different types: reverse old completely, then apply new completely
        // - Same types: reverse old, then apply new
        const totalDelta = -oldBalanceDelta + newBalanceDelta;
        if (totalDelta !== 0) {
          await accountBalanceService.incrementAccountBalance(
            newAccountId,
            totalDelta,
            tx
          );
        }
      } else {
        // Different accounts: reverse old on old account, apply new on new account
        await accountBalanceService.incrementAccountBalance(
          oldAccountId,
          -oldBalanceDelta,
          tx
        );
        await accountBalanceService.incrementAccountBalance(
          newAccountId,
          newBalanceDelta,
          tx
        );
      }
    }

    // Update budgets for this transaction
    await updateBudgetForTransaction(
      {
        id: updatedTransaction.id,
        accountId: updatedTransaction.accountId,
        categoryId: updatedTransaction.categoryId,
        payeeId: updatedTransaction.payeeId,
        userId,
        workspaceId,
        value: Number(updatedTransaction.value),
        date: updatedTransaction.date,
        categoryType: newCategory?.categoryType ?? null,
      },
      'update',
      {
        accountId: oldAccountId,
        categoryId: existingTransaction.categoryId,
        payeeId: null,
        value: oldValue,
        date: existingTransaction.date,
        categoryType: oldCategory?.categoryType ?? null,
      },
      tx
    );

    // Get old transaction for event (before update)
    const oldTransaction = await transactionRepository.findById(
      transactionId,
      workspaceId,
      undefined,
      {
        account: true,
        category: true,
        payee: true,
      }
    );

    // Return transaction with relations
    const result = await transactionRepository.findById(
      updatedTransaction.id,
      workspaceId,
      undefined,
      {
        account: true,
        category: true,
        payee: true,
      }
    );
    if (!result) {
      throw new Error('Transaction not found after update');
    }

    const newTransaction = {
      ...result,
      value: Number(result.value),
    } as unknown as {
      id: string;
      value: number | string;
      date: Date;
      accountId: string;
      categoryId: string | null;
      payeeId: string | null;
      note: string | null;
      userId: string;
      account: unknown;
      category: unknown;
      payee: unknown;
    };

    // Emit event after transaction update (for additional side effects)
    if (oldTransaction) {
      transactionEventEmitter.emit(
        'transaction.updated',
        oldTransaction,
        result
      );
    }

    // Invalidate caches after transaction update (only if not in transaction)
    if (!tx) {
      const accountIdsToInvalidate = new Set([oldAccountId, newAccountId]);
      await Promise.all([
        ...Array.from(accountIdsToInvalidate).map((accountId) =>
          invalidateAccountBalance(accountId).catch(() => {})
        ),
        postgresCache.invalidateUserCache(userId).catch(() => {}),
      ]);
    }

    return newTransaction;
  }
}

// Export singleton instance for backward compatibility
let defaultInstance: TransactionService | null = null;

/**
 * Get default TransactionService instance
 * @param prismaClient - Optional Prisma client (uses default if not provided)
 * @returns Default service instance
 */
export function getTransactionService(
  prismaClient?: PrismaTransaction | PrismaClient
): TransactionService {
  if (!defaultInstance || prismaClient) {
    defaultInstance = new TransactionService(prismaClient ?? prisma);
  }
  return defaultInstance;
}

// Export functions for backward compatibility (deprecated - use class instead)
/**
 * @deprecated Use TransactionService class instead
 */
export async function createTransaction(
  validatedInput: {
    value: number;
    date?: Date;
    accountId: string;
    categoryId?: string | null;
    payeeId?: string | null;
    note?: string | null;
  },
  userId: string,
  workspaceId: string,
  tx: PrismaTransaction | PrismaClient
): Promise<{
  id: string;
  value: number | string;
  date: Date;
  accountId: string;
  categoryId: string | null;
  payeeId: string | null;
  note: string | null;
  userId: string;
  account: unknown;
  category: unknown;
  payee: unknown;
}> {
  const service = new TransactionService(tx);
  return service.createTransaction(validatedInput, userId, workspaceId, tx);
}

/**
 * @deprecated Use TransactionService class instead
 */
export async function updateTransactionWithBalance(
  transactionId: string,
  validatedInput: {
    value?: number;
    date?: Date;
    accountId?: string;
    categoryId?: string | null;
    payeeId?: string | null;
    note?: string | null;
  },
  existingTransaction: {
    value: number;
    accountId: string;
    categoryId: string | null;
    category: { categoryType: 'Income' | 'Expense' } | null;
    date: Date;
  },
  newCategory: { categoryType: 'Income' | 'Expense' } | null,
  userId: string,
  workspaceId: string,
  tx: PrismaTransaction | PrismaClient
): Promise<{
  id: string;
  value: number | string;
  date: Date;
  accountId: string;
  categoryId: string | null;
  payeeId: string | null;
  note: string | null;
  userId: string;
  account: unknown;
  category: unknown;
  payee: unknown;
}> {
  const service = new TransactionService(tx);
  return service.updateTransactionWithBalance(
    transactionId,
    validatedInput,
    existingTransaction,
    newCategory,
    userId,
    workspaceId,
    tx
  );
}
