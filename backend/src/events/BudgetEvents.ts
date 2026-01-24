/**
 * Budget Event Types
 * Defines all budget-related events and their payloads
 */

import type { Budget } from '@prisma/client';

/**
 * Budget event payloads
 */
export interface BudgetEventPayloads extends Record<string, unknown[]> {
  'budget.created': [Budget];
  'budget.updated': [Budget, Budget]; // [oldBudget, newBudget]
  'budget.deleted': [Budget];
}

import type { TypedEventEmitter } from './EventEmitter';

/**
 * Budget event emitter type
 */
export type BudgetEventEmitter = TypedEventEmitter<BudgetEventPayloads>;
