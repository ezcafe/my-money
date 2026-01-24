/**
 * Event system exports
 */

export { TypedEventEmitter } from './EventEmitter';
export type {
  TransactionEventPayloads,
  TransactionEventEmitter,
} from './TransactionEvents';
export type {
  AccountEventPayloads,
  AccountEventEmitter,
} from './AccountEvents';
export type {
  CategoryEventPayloads,
  CategoryEventEmitter,
} from './CategoryEvents';
export type { PayeeEventPayloads, PayeeEventEmitter } from './PayeeEvents';
export type { BudgetEventPayloads, BudgetEventEmitter } from './BudgetEvents';

// Create singleton event emitter instances
import { TypedEventEmitter } from './EventEmitter';
import type { TransactionEventPayloads } from './TransactionEvents';
import type { AccountEventPayloads } from './AccountEvents';
import type { CategoryEventPayloads } from './CategoryEvents';
import type { PayeeEventPayloads } from './PayeeEvents';
import type { BudgetEventPayloads } from './BudgetEvents';

/**
 * Global transaction event emitter instance
 * Use this to emit and listen to transaction events
 */
export const transactionEventEmitter =
  new TypedEventEmitter<TransactionEventPayloads>();

/**
 * Global account event emitter instance
 * Use this to emit and listen to account events
 */
export const accountEventEmitter =
  new TypedEventEmitter<AccountEventPayloads>();

/**
 * Global category event emitter instance
 * Use this to emit and listen to category events
 */
export const categoryEventEmitter =
  new TypedEventEmitter<CategoryEventPayloads>();

/**
 * Global payee event emitter instance
 * Use this to emit and listen to payee events
 */
export const payeeEventEmitter = new TypedEventEmitter<PayeeEventPayloads>();

/**
 * Global budget event emitter instance
 * Use this to emit and listen to budget events
 */
export const budgetEventEmitter = new TypedEventEmitter<BudgetEventPayloads>();
