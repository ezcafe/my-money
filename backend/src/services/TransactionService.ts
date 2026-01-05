/**
 * Transaction Service
 * Handles complex transaction business logic
 * Extracted from TransactionResolver to improve separation of concerns
 */

import type {PrismaClient} from '@prisma/client';
import {incrementAccountBalance} from './AccountBalanceService';
import {updateBudgetForTransaction} from './BudgetService';
import {sanitizeUserInput} from '../utils/sanitization';

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
    category: {type: 'INCOME' | 'EXPENSE'} | null;
    date: Date;
  },
  newCategory: {type: 'INCOME' | 'EXPENSE'} | null,
  userId: string,
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
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
  const oldBalanceDelta = oldCategory?.type === 'INCOME'
    ? oldValue
    : -oldValue;

  const newValue = validatedInput.value !== undefined
    ? validatedInput.value
    : oldValue;
  const oldAccountId = existingTransaction.accountId;
  const newAccountId = validatedInput.accountId ?? oldAccountId;

  // Calculate new balance delta based on new category type
  const newBalanceDelta = newCategory?.type === 'INCOME'
    ? newValue
    : -newValue;

  // Update transaction
  const updatedTransaction = await tx.transaction.update({
    where: {id: transactionId},
    data: {
      ...(validatedInput.value !== undefined && {value: validatedInput.value}),
      ...(validatedInput.date !== undefined && {date: validatedInput.date}),
      ...(validatedInput.accountId !== undefined && {accountId: validatedInput.accountId}),
      ...(validatedInput.categoryId !== undefined && {categoryId: validatedInput.categoryId}),
      ...(validatedInput.payeeId !== undefined && {payeeId: validatedInput.payeeId}),
      ...(validatedInput.note !== undefined && {note: validatedInput.note ? sanitizeUserInput(validatedInput.note) : null}),
    },
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
      categoryType: newCategory?.type ?? null,
    },
    'update',
    {
      accountId: oldAccountId,
      categoryId: existingTransaction.categoryId,
      payeeId: null,
      value: oldValue,
      date: existingTransaction.date,
      categoryType: oldCategory?.type ?? null,
    },
    tx,
  );

  // Return transaction with relations
  const result = await tx.transaction.findUnique({
    where: {id: updatedTransaction.id},
    include: {
      account: true,
      category: true,
      payee: true,
    },
  });
  if (!result) {
    throw new Error('Transaction not found after update');
  }
  return {
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
}

