/**
 * Workspace Resolver
 * Handles all workspace-related GraphQL operations
 */

import type { GraphQLContext } from '../middleware/context';
import type {
  WorkspaceRole,
  Workspace,
  WorkspaceMember,
  WorkspaceInvitation,
} from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { withPrismaErrorHandling } from '../utils/prismaErrors';
import {
  getUserWorkspaces,
  getWorkspaceMembers,
  checkWorkspaceAccess,
  checkWorkspacePermission,
} from '../services/WorkspaceService';
import {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  cancelInvitation,
  getWorkspaceInvitations,
} from '../services/InvitationService';
import { sendInvitationEmail } from '../services/EmailService';
import { sanitizeUserInput } from '../utils/sanitization';

export class WorkspaceResolver {
  /**
   * Get all workspaces the current user belongs to
   */
  async workspaces(
    _: unknown,
    __: unknown,
    context: GraphQLContext
  ): Promise<Workspace[]> {
    const workspaceIds = await getUserWorkspaces(context.userId);

    const workspaces = await withPrismaErrorHandling(
      async () =>
        await context.prisma.workspace.findMany({
          where: {
            id: {
              in: workspaceIds,
            },
          },
          include: {
            _count: {
              select: {
                members: true,
                accounts: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
      { resource: 'Workspace', operation: 'read' }
    );

    return workspaces;
  }

  /**
   * Get workspace by ID
   */
  async workspace(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<Workspace> {
    // Verify user has access
    await checkWorkspaceAccess(id, context.userId);

    const workspace = await withPrismaErrorHandling(
      async () =>
        await context.prisma.workspace.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                members: true,
                accounts: true,
              },
            },
          },
        }),
      { resource: 'Workspace', operation: 'read' }
    );

    if (!workspace) {
      throw new NotFoundError('Workspace');
    }

    return workspace;
  }

  /**
   * Get workspace members
   */
  async workspaceMembers(
    _: unknown,
    { workspaceId }: { workspaceId: string },
    context: GraphQLContext
  ): Promise<WorkspaceMember[]> {
    return getWorkspaceMembers(workspaceId, context.userId);
  }

  /**
   * Get workspace invitations
   */
  async workspaceInvitations(
    _: unknown,
    { workspaceId }: { workspaceId: string },
    context: GraphQLContext
  ): Promise<WorkspaceInvitation[]> {
    return getWorkspaceInvitations(workspaceId, context.userId);
  }

  /**
   * Get invitation by token (public, no auth required for viewing invitation details)
   */
  async invitationByToken(
    _: unknown,
    { token }: { token: string },
    _context: GraphQLContext
  ): Promise<WorkspaceInvitation | null> {
    return getInvitationByToken(token);
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(
    _: unknown,
    { input }: { input: { name: string } },
    context: GraphQLContext
  ): Promise<Workspace> {
    const sanitizedName = sanitizeUserInput(input.name);

    if (!sanitizedName || sanitizedName.trim().length === 0) {
      throw new Error('Workspace name is required');
    }

    const workspace = await withPrismaErrorHandling(
      async () =>
        await context.prisma.workspace.create({
          data: {
            name: sanitizedName,
            members: {
              create: {
                userId: context.userId,
                role: 'Owner',
              },
            },
          },
          include: {
            _count: {
              select: {
                members: true,
                accounts: true,
              },
            },
          },
        }),
      { resource: 'Workspace', operation: 'create' }
    );

    return workspace;
  }

  /**
   * Update workspace
   */
  async updateWorkspace(
    _: unknown,
    { id, input }: { id: string; input: { name?: string } },
    context: GraphQLContext
  ): Promise<Workspace> {
    // Verify user has admin/owner permission
    await checkWorkspacePermission(id, context.userId, 'Admin');

    const updateData: { name?: string } = {};
    if (input.name !== undefined) {
      const sanitizedName = sanitizeUserInput(input.name);
      if (!sanitizedName || sanitizedName.trim().length === 0) {
        throw new Error('Workspace name cannot be empty');
      }
      updateData.name = sanitizedName;
    }

    const workspace = await withPrismaErrorHandling(
      async () =>
        await context.prisma.workspace.update({
          where: { id },
          data: updateData,
          include: {
            _count: {
              select: {
                members: true,
                accounts: true,
              },
            },
          },
        }),
      { resource: 'Workspace', operation: 'update' }
    );

    return workspace;
  }

  /**
   * Delete workspace (Owner only)
   */
  async deleteWorkspace(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<boolean> {
    // Verify user is owner
    await checkWorkspacePermission(id, context.userId, 'Owner');

    await withPrismaErrorHandling(
      async () => await context.prisma.workspace.delete({ where: { id } }),
      { resource: 'Workspace', operation: 'delete' }
    );

    return true;
  }

  /**
   * Invite user to workspace
   */
  async inviteUserToWorkspace(
    _: unknown,
    {
      workspaceId,
      email,
      role,
    }: {
      workspaceId: string;
      email: string;
      role?: WorkspaceRole;
    },
    context: GraphQLContext
  ): Promise<WorkspaceInvitation> {
    const sanitizedEmail = sanitizeUserInput(email);
    if (!sanitizedEmail?.includes('@')) {
      throw new Error('Valid email address is required');
    }

    // Create invitation
    const invitation = await createInvitation(
      workspaceId,
      sanitizedEmail,
      role ?? 'Member',
      context.userId,
      7 // 7 days expiration
    );

    // Get workspace name for email
    const workspace = await context.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    if (!workspace) {
      throw new NotFoundError('Workspace');
    }

    // Send invitation email (fire and forget)
    try {
      sendInvitationEmail(
        sanitizedEmail,
        invitation.token,
        workspace.name,
        context.userEmail ?? ''
      );
    } catch (error) {
      // Log error but don't fail the mutation
      console.error('Failed to send invitation email:', error);
    }

    return invitation;
  }

  /**
   * Accept workspace invitation
   */
  async acceptWorkspaceInvitation(
    _: unknown,
    { token }: { token: string },
    context: GraphQLContext
  ): Promise<WorkspaceMember> {
    const member = await acceptInvitation(token, context.userId);
    return member;
  }

  /**
   * Cancel workspace invitation
   */
  async cancelWorkspaceInvitation(
    _: unknown,
    { invitationId }: { invitationId: string },
    context: GraphQLContext
  ): Promise<boolean> {
    return cancelInvitation(invitationId, context.userId);
  }

  /**
   * Update workspace member role
   */
  async updateWorkspaceMemberRole(
    _: unknown,
    {
      workspaceId,
      memberId,
      role,
    }: {
      workspaceId: string;
      memberId: string;
      role: WorkspaceRole;
    },
    context: GraphQLContext
  ): Promise<WorkspaceMember> {
    // Verify user has admin/owner permission
    await checkWorkspacePermission(workspaceId, context.userId, 'Admin');

    // Check if member exists
    const member = await context.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberId,
        },
      },
    });

    if (!member) {
      throw new NotFoundError('Workspace member');
    }

    // Prevent removing owner role if it's the only owner
    if (member.role === 'Owner' && role !== 'Owner') {
      const ownerCount = await context.prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: 'Owner',
        },
      });

      if (ownerCount <= 1) {
        throw new ForbiddenError(
          'Cannot remove the only owner of the workspace'
        );
      }
    }

    // Prevent changing own role if owner
    if (
      member.userId === context.userId &&
      member.role === 'Owner' &&
      role !== 'Owner'
    ) {
      throw new ForbiddenError('Cannot change your own role from Owner');
    }

    const updatedMember = await withPrismaErrorHandling(
      async () =>
        await context.prisma.workspaceMember.update({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId: memberId,
            },
          },
          data: { role },
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
            workspace: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      { resource: 'WorkspaceMember', operation: 'update' }
    );

    return updatedMember;
  }

  /**
   * Remove workspace member
   */
  async removeWorkspaceMember(
    _: unknown,
    {
      workspaceId,
      memberId,
    }: {
      workspaceId: string;
      memberId: string;
    },
    context: GraphQLContext
  ): Promise<boolean> {
    // Verify user has admin/owner permission
    await checkWorkspacePermission(workspaceId, context.userId, 'Admin');

    // Check if member exists
    const member = await context.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberId,
        },
      },
    });

    if (!member) {
      throw new NotFoundError('Workspace member');
    }

    // Prevent removing the only owner
    if (member.role === 'Owner') {
      const ownerCount = await context.prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: 'Owner',
        },
      });

      if (ownerCount <= 1) {
        throw new ForbiddenError(
          'Cannot remove the only owner of the workspace'
        );
      }
    }

    // Prevent removing self if owner
    if (member.userId === context.userId && member.role === 'Owner') {
      throw new ForbiddenError(
        'Cannot remove yourself as owner. Transfer ownership first.'
      );
    }

    await withPrismaErrorHandling(
      async () =>
        await context.prisma.workspaceMember.delete({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId: memberId,
            },
          },
        }),
      { resource: 'WorkspaceMember', operation: 'delete' }
    );

    return true;
  }
}
