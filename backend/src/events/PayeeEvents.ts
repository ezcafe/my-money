/**
 * Payee Event Types
 * Defines all payee-related events and their payloads
 */

import type { Payee } from '@prisma/client';

/**
 * Payee event payloads
 */
export interface PayeeEventPayloads extends Record<string, unknown[]> {
  'payee.created': [Payee];
  'payee.updated': [Payee, Payee]; // [oldPayee, newPayee]
  'payee.deleted': [Payee];
}

import type { TypedEventEmitter } from './EventEmitter';

/**
 * Payee event emitter type
 */
export type PayeeEventEmitter = TypedEventEmitter<PayeeEventPayloads>;
