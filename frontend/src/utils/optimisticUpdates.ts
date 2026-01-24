/**
 * Optimistic Update Utilities
 * Provides helper functions for creating optimistic responses
 */

/**
 * Create an optimistic response for a mutation
 * @param mutationName - Name of the mutation
 * @param data - Data to use for optimistic response
 * @returns Optimistic response object
 */
export function createOptimisticResponse<TData>(
  mutationName: string,
  data: TData
): Record<string, TData> {
  return {
    [mutationName]: data,
  };
}

/**
 * Create optimistic transaction response
 * @param transaction - Transaction data
 * @returns Optimistic transaction response
 */
export function createOptimisticTransaction(transaction: {
  id?: string;
  value: number;
  date: Date | string;
  accountId: string;
  categoryId?: string | null;
  payeeId?: string | null;
  note?: string | null;
}): {
  id: string;
  value: number;
  date: string;
  accountId: string;
  categoryId: string | null;
  payeeId: string | null;
  note: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
} {
  const now = new Date().toISOString();
  return {
    id: transaction.id ?? `temp-${Date.now()}`,
    value: transaction.value,
    date: typeof transaction.date === 'string' ? transaction.date : transaction.date.toISOString(),
    accountId: transaction.accountId,
    categoryId: transaction.categoryId ?? null,
    payeeId: transaction.payeeId ?? null,
    note: transaction.note ?? null,
    userId: 'temp-user',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create optimistic account response
 * @param account - Account data
 * @returns Optimistic account response
 */
export function createOptimisticAccount(account: {
  id?: string;
  name: string;
  initBalance?: number;
}): {
  id: string;
  name: string;
  initBalance: number;
  balance: number;
  isDefault: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
} {
  const now = new Date().toISOString();
  return {
    id: account.id ?? `temp-${Date.now()}`,
    name: account.name,
    initBalance: account.initBalance ?? 0,
    balance: account.initBalance ?? 0,
    isDefault: false,
    userId: 'temp-user',
    createdAt: now,
    updatedAt: now,
  };
}
