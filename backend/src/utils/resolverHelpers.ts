/**
 * Resolver Helper Utilities
 * Common patterns for resolvers (pagination, authorization, etc.)
 */

import type { GraphQLContext } from '../middleware/context';
import { getUserDefaultWorkspace } from '../services/WorkspaceService';
import { checkWorkspaceAccess } from '../services/WorkspaceService';
import { NotFoundError } from './errors';

/**
 * Pagination input
 */
export interface PaginationInput {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

/**
 * Pagination result
 */
export interface PaginationResult<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
  previousCursor: string | null;
}

/**
 * Parse cursor for pagination
 * @param cursor - Base64 encoded cursor
 * @returns Parsed offset and orderBy info
 */
export function parseCursor(cursor: string | null | undefined): {
  offset: number;
  orderBy?: string;
} {
  if (!cursor) {
    return { offset: 0 };
  }

  try {
    const decoded = Buffer.from(cursor, 'base64');
    const cursorData = JSON.parse(decoded.toString('utf-8')) as {
      offset: number;
      orderBy?: string;
    };
    return cursorData;
  } catch {
    try {
      const decoded = Buffer.from(cursor, 'base64');
      const offset = Number.parseInt(decoded.toString('utf-8'), 10);
      return { offset: isNaN(offset) ? 0 : offset };
    } catch {
      return { offset: 0 };
    }
  }
}

/**
 * Create cursor from offset and orderBy
 * @param offset - Offset value
 * @param orderBy - Optional orderBy string
 * @returns Base64 encoded cursor
 */
export function createCursor(offset: number, orderBy?: string): string {
  const buffer = Buffer.from(JSON.stringify({ offset, orderBy }), 'utf-8');
  return buffer.toString('base64');
}

/**
 * Ensure workspace access
 * Gets workspace ID from context or user's default workspace
 * Verifies user has access to the workspace
 * @param context - GraphQL context
 * @param workspaceId - Optional workspace ID (if not provided, uses context or default)
 * @returns Workspace ID
 */
export async function ensureWorkspaceAccess(
  context: GraphQLContext,
  workspaceId?: string
): Promise<string> {
  const finalWorkspaceId =
    workspaceId ??
    context.currentWorkspaceId ??
    (await getUserDefaultWorkspace(context.userId));
  await checkWorkspaceAccess(finalWorkspaceId, context.userId);
  return finalWorkspaceId;
}

/**
 * Verify entity exists in workspace
 * @param repository - Repository instance with findById method
 * @param id - Entity ID
 * @param workspaceId - Workspace ID
 * @param select - Optional select clause
 * @returns Entity if found, null otherwise
 */
export async function verifyEntityInWorkspace<T>(
  repository: {
    findById: (
      id: string,
      workspaceId: string,
      select?: Record<string, boolean>
    ) => Promise<T | null>;
  },
  id: string,
  workspaceId: string,
  select?: Record<string, boolean>
): Promise<T | null> {
  return repository.findById(id, workspaceId, select);
}

/**
 * Require entity exists in workspace (throws if not found)
 * @param repository - Repository instance with findById method
 * @param id - Entity ID
 * @param workspaceId - Workspace ID
 * @param entityName - Entity name for error message
 * @param select - Optional select clause
 * @returns Entity
 * @throws NotFoundError if entity not found
 */
export async function requireEntityInWorkspace<T>(
  repository: {
    findById: (
      id: string,
      workspaceId: string,
      select?: Record<string, boolean>
    ) => Promise<T | null>;
  },
  id: string,
  workspaceId: string,
  entityName: string,
  select?: Record<string, boolean>
): Promise<T> {
  const entity = await verifyEntityInWorkspace(
    repository,
    id,
    workspaceId,
    select
  );
  if (!entity) {
    throw new NotFoundError(entityName);
  }
  return entity;
}

/**
 * Calculate pagination limits
 * @param input - Pagination input
 * @param maxPageSize - Maximum page size
 * @returns Calculated limit and offset
 */
export function calculatePagination(
  input: PaginationInput,
  maxPageSize: number = 100
): { limit: number; offset: number } {
  let limit = input.first ?? input.last ?? 20;
  limit = Math.min(limit, maxPageSize);

  let offset = 0;

  if (input.after) {
    const cursorData = parseCursor(input.after);
    offset = cursorData.offset ?? 0;
  } else if (input.before) {
    const cursorData = parseCursor(input.before);
    const beforeOffset = cursorData.offset ?? 0;
    offset = Math.max(0, beforeOffset - (input.last ?? 20));
  }

  return { limit, offset };
}

/**
 * Build pagination result
 * @param items - Items for current page
 * @param totalCount - Total count of items
 * @param offset - Current offset
 * @param limit - Page limit
 * @param orderBy - Optional orderBy string for cursor
 * @returns Pagination result
 */
export function buildPaginationResult<T>(
  items: T[],
  totalCount: number,
  offset: number,
  limit: number,
  orderBy?: string
): PaginationResult<T> {
  const hasMore = offset + limit < totalCount;
  const hasPrevious = offset > 0;

  return {
    items,
    totalCount,
    hasMore,
    nextCursor: hasMore ? createCursor(offset + limit, orderBy) : null,
    previousCursor: hasPrevious
      ? createCursor(Math.max(0, offset - limit), orderBy)
      : null,
  };
}
