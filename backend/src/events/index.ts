/**
 * Event system exports
 */

export {TypedEventEmitter} from './EventEmitter';
export type {TransactionEventPayloads, TransactionEventEmitter} from './TransactionEvents';

// Create singleton event emitter instance
import {TypedEventEmitter} from './EventEmitter';
import type {TransactionEventPayloads} from './TransactionEvents';

/**
 * Global transaction event emitter instance
 * Use this to emit and listen to transaction events
 */
export const transactionEventEmitter = new TypedEventEmitter<TransactionEventPayloads>();
