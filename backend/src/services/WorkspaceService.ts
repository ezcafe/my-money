/**
 * Workspace Service
 * Provides business logic for workspace membership, permissions, and default workspace management
 */

import type {WorkspaceRole} from '@prisma/client';
import {prisma} from '../utils/prisma';
import {NotFoundError, ForbiddenError} from '../utils/errors';

/**
 * Get all workspaces a user belongs to
 * @param userId - User ID
 * @returns Array of workspace IDs
 */
export async function getUserWorkspaces(userId: string): Promise<string[]> {
  const members = await prisma.workspaceMember.findMany({
    where: {userId},
    select: {workspaceId: true},
  });
  return members.map((m) => m.workspaceId);
}

/**
 * Get workspace members
 * @param workspaceId - Workspace ID
 * @param userId - User ID (for permission check)
 * @returns Array of workspace members
 */
export async function getWorkspaceMembers(workspaceId: string, userId: string) {
  // Verify user has access to workspace
  await checkWorkspaceAccess(workspaceId, userId);

  return prisma.workspaceMember.findMany({
    where: {workspaceId},
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Check if user has access to workspace (is a member)
 * @param workspaceId - Workspace ID
 * @param userId - User ID
 * @throws NotFoundError if workspace not found or user doesn't have access
 */
export async function checkWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: {id: workspaceId},
    select: {id: true},
  });

  if (!workspace) {
    throw new NotFoundError('Workspace');
  }

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: {id: true},
  });

  if (!member) {
    throw new NotFoundError('Workspace');
  }
}

/**
 * Check if user has required permission in workspace
 * @param workspaceId - Workspace ID
 * @param userId - User ID
 * @param requiredRole - Minimum required role
 * @throws ForbiddenError if user doesn't have required permission
 */
export async function checkWorkspacePermission(
  workspaceId: string,
  userId: string,
  requiredRole: WorkspaceRole,
): Promise<void> {
  // First check access
  await checkWorkspaceAccess(workspaceId, userId);

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: {role: true},
  });

  if (!member) {
    throw new ForbiddenError('Insufficient permissions for this workspace');
  }

  // Role hierarchy: Owner > Admin > Member
  const roleHierarchy: Record<WorkspaceRole, number> = {
    Owner: 3,
    Admin: 2,
    Member: 1,
  };

  if (roleHierarchy[member.role] < roleHierarchy[requiredRole]) {
    throw new ForbiddenError('Insufficient permissions for this workspace');
  }
}

/**
 * Get or create default workspace for user
 * Creates a default workspace if user doesn't have one
 * @param userId - User ID
 * @returns Workspace ID
 */
export async function getUserDefaultWorkspace(userId: string): Promise<string> {
  // Validate userId is provided
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('User ID is required to get default workspace');
  }

  // Check if user has any workspace
  const member = await prisma.workspaceMember.findFirst({
    where: {userId},
    select: {workspaceId: true},
    orderBy: {joinedAt: 'asc'}, // Get first workspace (oldest)
  });

  if (member) {
    return member.workspaceId;
  }

  // Create default workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'My Workspace',
      members: {
        create: {
          userId,
          role: 'Owner',
        },
      },
    },
    select: {id: true},
  });

  return workspace.id;
}
