/**
 * Account Event Types
 * Defines all account-related events and their payloads
 */

import type {Account} from '@prisma/client';

/**
 * Account event payloads
 */
export interface AccountEventPayloads extends Record<string, unknown[]> {
  'account.created': [Account];
  'account.updated': [Account, Account]; // [oldAccount, newAccount]
  'account.deleted': [Account];
}

import type {TypedEventEmitter} from './EventEmitter';

/**
 * Account event emitter type
 */
export type AccountEventEmitter = TypedEventEmitter<AccountEventPayloads>;
