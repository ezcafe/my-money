/**
 * Branded Types
 * Provides type-safe IDs to prevent mixing different ID types
 * Using TypeScript's branded types pattern for compile-time safety
 */

/**
 * Branded type for User IDs
 */
export type UserId = string & { readonly __brand: 'UserId' };

/**
 * Branded type for Account IDs
 */
export type AccountId = string & { readonly __brand: 'AccountId' };

/**
 * Branded type for Category IDs
 */
export type CategoryId = string & { readonly __brand: 'CategoryId' };

/**
 * Branded type for Payee IDs
 */
export type PayeeId = string & { readonly __brand: 'PayeeId' };

/**
 * Branded type for Transaction IDs
 */
export type TransactionId = string & { readonly __brand: 'TransactionId' };

/**
 * Branded type for Budget IDs
 */
export type BudgetId = string & { readonly __brand: 'BudgetId' };

/**
 * Branded type for Workspace IDs
 */
export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };

/**
 * Branded type for Workspace Member IDs
 */
export type WorkspaceMemberId = string & {
  readonly __brand: 'WorkspaceMemberId';
};

/**
 * Create a UserId from a string
 * @param id - String ID
 * @returns Branded UserId
 */
export function toUserId(id: string): UserId {
  return id as UserId;
}

/**
 * Create an AccountId from a string
 * @param id - String ID
 * @returns Branded AccountId
 */
export function toAccountId(id: string): AccountId {
  return id as AccountId;
}

/**
 * Create a CategoryId from a string
 * @param id - String ID
 * @returns Branded CategoryId
 */
export function toCategoryId(id: string): CategoryId {
  return id as CategoryId;
}

/**
 * Create a PayeeId from a string
 * @param id - String ID
 * @returns Branded PayeeId
 */
export function toPayeeId(id: string): PayeeId {
  return id as PayeeId;
}

/**
 * Create a TransactionId from a string
 * @param id - String ID
 * @returns Branded TransactionId
 */
export function toTransactionId(id: string): TransactionId {
  return id as TransactionId;
}

/**
 * Create a BudgetId from a string
 * @param id - String ID
 * @returns Branded BudgetId
 */
export function toBudgetId(id: string): BudgetId {
  return id as BudgetId;
}

/**
 * Create a WorkspaceId from a string
 * @param id - String ID
 * @returns Branded WorkspaceId
 */
export function toWorkspaceId(id: string): WorkspaceId {
  return id as WorkspaceId;
}

/**
 * Create a WorkspaceMemberId from a string
 * @param id - String ID
 * @returns Branded WorkspaceMemberId
 */
export function toWorkspaceMemberId(id: string): WorkspaceMemberId {
  return id as WorkspaceMemberId;
}
