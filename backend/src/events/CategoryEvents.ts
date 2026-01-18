/**
 * Category Event Types
 * Defines all category-related events and their payloads
 */

import type {Category} from '@prisma/client';

/**
 * Category event payloads
 */
export interface CategoryEventPayloads extends Record<string, unknown[]> {
  'category.created': [Category];
  'category.updated': [Category, Category]; // [oldCategory, newCategory]
  'category.deleted': [Category];
}

import type {TypedEventEmitter} from './EventEmitter';

/**
 * Category event emitter type
 */
export type CategoryEventEmitter = TypedEventEmitter<CategoryEventPayloads>;
