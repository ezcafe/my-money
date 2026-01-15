/**
 * Transaction Event Types
 * Defines all transaction-related events and their payloads
 */

import type {Transaction} from '@prisma/client';

/**
 * Transaction event payloads
 */
export interface TransactionEventPayloads extends Record<string, unknown[]> {
  'transaction.created': [Transaction];
  'transaction.updated': [Transaction, Transaction]; // [oldTransaction, newTransaction]
  'transaction.deleted': [Transaction];
}

import type {TypedEventEmitter} from './EventEmitter';

/**
 * Transaction event emitter type
 */
export type TransactionEventEmitter = TypedEventEmitter<TransactionEventPayloads>;
