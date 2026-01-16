/**
 * Transaction Service
 * Handles complex transaction business logic
 * Extracted from TransactionResolver to improve separation of concerns
 */

import type {PrismaClient} from '@prisma/client';
import {TransactionRepository} from '../repositories/TransactionRepository';
import {CategoryRepository} from '../repositories/CategoryRepository';
import {PayeeRepository} from '../repositories/PayeeRepository';
import {AccountRepository} from '../repositories/AccountRepository';
import {incrementAccountBalance} from './AccountBalanceService';
import {updateBudgetForTransaction} from './BudgetService';
import {transactionEventEmitter} from '../events';
import {sanitizeUserInput} from '../utils/sanitization';
import {NotFoundError} from '../utils/errors';
import * as postgresCache from '../utils/postgresCache';
import {invalidateAccountBalance} from '../utils/cache';

/**
 * Create a new transaction with balance and budget updates
 * Handles complex business logic for creating transactions including:
 * - Category type verification
 * - Balance delta calculations based on category types
 * - Account balance updates
 * - Budget updates
 * @param validatedInput - Validated input data
 * @param userId - User ID
 * @param tx - Prisma transaction client
 * @returns Created transaction with relations
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
  tx: PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
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
  const transactionRepository = new TransactionRepository(tx);
  const categoryRepository = new CategoryRepository(tx);
  const payeeRepository = new PayeeRepository(tx);
  const accountRepository = new AccountRepository(tx);

  // Verify account belongs to user
  const account = await accountRepository.findById(validatedInput.accountId, userId, {id: true});
  if (!account) {
    throw new NotFoundError('Account');
  }

  // Verify category and payee in parallel if both are provided
  let category: {categoryType: 'Income' | 'Expense'} | null = null;

  const [foundCategory, foundPayee] = await Promise.all([
    validatedInput.categoryId
      ? categoryRepository.findById(validatedInput.categoryId, userId, {id: true, categoryType: true})
      : Promise.resolve(null),
    validatedInput.payeeId
      ? payeeRepository.findById(validatedInput.payeeId, userId, {id: true})
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
  const balanceDelta = category?.categoryType === 'Income'
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
    userId,
  });

  // Update account balance incrementally based on category type
  await incrementAccountBalance(validatedInput.accountId, balanceDelta, tx);

  // Return transaction with relations
  const transactionWithRelations = await transactionRepository.findById(
    newTransaction.id,
    userId,
    undefined,
    {
      account: true,
      category: true,
      payee: true,
    },
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
      userId: transactionWithRelations.userId,
      value: Number(transactionWithRelations.value),
      date: transactionWithRelations.date,
      categoryType: category?.categoryType ?? null,
    },
    'create',
    undefined,
    tx,
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
  transactionEventEmitter.emit('transaction.created', transactionWithRelations);

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
 * @param tx - Prisma transaction client
 * @returns Updated transaction with relations
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
    category: {categoryType: 'Income' | 'Expense'} | null;
    date: Date;
  },
  newCategory: {categoryType: 'Income' | 'Expense'} | null,
  userId: string,
  tx: PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
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
  // Calculate old balance delta based on old category type
  const oldCategory = existingTransaction.category;
  const oldValue = Number(existingTransaction.value);
  const oldBalanceDelta = oldCategory?.categoryType === 'Income'
    ? oldValue
    : -oldValue;

  const newValue = validatedInput.value ?? oldValue;
  const oldAccountId = existingTransaction.accountId;
  const newAccountId = validatedInput.accountId ?? oldAccountId;

  // Calculate new balance delta based on new category type
  const newBalanceDelta = newCategory?.categoryType === 'Income'
    ? newValue
    : -newValue;

  const transactionRepository = new TransactionRepository(tx);

  // Update transaction
  const updatedTransaction = await transactionRepository.update(transactionId, {
    ...(validatedInput.value !== undefined && {value: validatedInput.value}),
    ...(validatedInput.date !== undefined && {date: validatedInput.date}),
    ...(validatedInput.accountId !== undefined && {accountId: validatedInput.accountId}),
    ...(validatedInput.categoryId !== undefined && {categoryId: validatedInput.categoryId}),
    ...(validatedInput.payeeId !== undefined && {payeeId: validatedInput.payeeId}),
    ...(validatedInput.note !== undefined && {note: validatedInput.note ? sanitizeUserInput(validatedInput.note) : null}),
  });

  // Adjust account balances
  // Need to reverse old balance change and apply new balance change
  const needsBalanceUpdate = validatedInput.value !== undefined
    || validatedInput.accountId !== undefined
    || validatedInput.categoryId !== undefined;

  if (needsBalanceUpdate) {
    if (oldAccountId === newAccountId) {
      // Same account: reverse old balance change and apply new balance change
      // Formula: -oldBalanceDelta + newBalanceDelta works for both cases:
      // - Different types: reverse old completely, then apply new completely
      // - Same types: reverse old, then apply new
      const totalDelta = -oldBalanceDelta + newBalanceDelta;
      if (totalDelta !== 0) {
        await incrementAccountBalance(newAccountId, totalDelta, tx);
      }
    } else {
      // Different accounts: reverse old on old account, apply new on new account
      await incrementAccountBalance(oldAccountId, -oldBalanceDelta, tx);
      await incrementAccountBalance(newAccountId, newBalanceDelta, tx);
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
    tx,
  );

  // Get old transaction for event (before update)
  const oldTransaction = await transactionRepository.findById(
    transactionId,
    userId,
    undefined,
    {
      account: true,
      category: true,
      payee: true,
    },
  );

  // Return transaction with relations
  const result = await transactionRepository.findById(
    updatedTransaction.id,
    userId,
    undefined,
    {
      account: true,
      category: true,
      payee: true,
    },
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
    transactionEventEmitter.emit('transaction.updated', oldTransaction, result);
  }

  // Invalidate caches after transaction update (only if not in transaction)
  if (!tx) {
    const accountIdsToInvalidate = new Set([oldAccountId, newAccountId]);
    await Promise.all([
      ...Array.from(accountIdsToInvalidate).map((accountId) =>
        invalidateAccountBalance(accountId).catch(() => {}),
      ),
      postgresCache.invalidateUserCache(userId).catch(() => {}),
    ]);
  }

  return newTransaction;
}

