/**
 * Authorization Middleware
 * Provides consistent authorization checks for resolvers
 * Uses workspace-based access control
 */

import type {GraphQLContext} from './context';
import {NotFoundError, ForbiddenError} from '../utils/errors';
import {checkWorkspaceAccess, checkWorkspacePermission} from '../services/WorkspaceService';
import type {WorkspaceRole} from '@prisma/client';

/**
 * Require workspace access - throws error if user doesn't have access
 * @param workspaceId - Workspace ID
 * @param userId - User ID
 * @param context - GraphQL context
 * @throws NotFoundError if workspace not found or user doesn't have access
 */
export async function requireWorkspaceAccess(
  workspaceId: string,
  userId: string,
  _context: GraphQLContext,
): Promise<void> {
  try {
    await checkWorkspaceAccess(workspaceId, userId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not have access')) {
      throw new NotFoundError('Workspace');
    }
    throw error;
  }
}

/**
 * Require workspace permission - throws error if user doesn't have required role
 * @param workspaceId - Workspace ID
 * @param userId - User ID
 * @param requiredRole - Minimum required role
 * @param context - GraphQL context
 * @throws ForbiddenError if user doesn't have required permission
 */
export async function requireWorkspacePermission(
  workspaceId: string,
  userId: string,
  requiredRole: WorkspaceRole,
  _context: GraphQLContext,
): Promise<void> {
  try {
    await checkWorkspacePermission(workspaceId, userId, requiredRole);
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not have')) {
      throw new ForbiddenError('Insufficient permissions for this workspace');
    }
    throw error;
  }
}

/**
 * Check if user can access an entity via workspace
 * Entities are accessed through their workspace membership
 * @param workspaceId - Workspace ID
 * @param userId - User ID
 * @param context - GraphQL context
 * @throws NotFoundError if workspace not found or user doesn't have access
 */
export async function requireEntityAccess(
  workspaceId: string,
  userId: string,
  context: GraphQLContext,
): Promise<void> {
  await requireWorkspaceAccess(workspaceId, userId, context);
}
