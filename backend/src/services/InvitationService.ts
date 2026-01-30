/**
 * Invitation Service
 * Handles workspace invitation creation, validation, acceptance, and cancellation
 */

import { randomBytes } from 'crypto';
import type {
  WorkspaceRole,
  WorkspaceInvitation,
  WorkspaceMember,
} from '@prisma/client';
import { prisma } from '../utils/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import {
  checkWorkspaceAccess,
  checkWorkspacePermission,
} from './WorkspaceService';

/**
 * Generate a cryptographically secure invitation token
 * Uses base64url encoding for URL-safe tokens
 * @returns Base64url-encoded token (32 bytes = 44 characters)
 */
export function generateInvitationToken(): string {
  const tokenBytes = randomBytes(32);
  // Convert to base64url (URL-safe base64)
  return tokenBytes.toString('base64url');
}

/**
 * Create a workspace invitation
 * @param workspaceId - Workspace ID
 * @param email - Invitee email address
 * @param role - Role to assign (default: Member)
 * @param invitedBy - User ID of the inviter
 * @param expiresInDays - Expiration in days (default: 7)
 * @returns Created invitation
 */
export async function createInvitation(
  workspaceId: string,
  email: string,
  role: WorkspaceRole = 'Member',
  invitedBy: string,
  expiresInDays: number = 7
): Promise<WorkspaceInvitation> {
  // Verify inviter has permission to invite (Admin or Owner)
  await checkWorkspacePermission(workspaceId, invitedBy, 'Admin');

  // Check if user is already a member
  const existingMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: {
        email,
      },
    },
  });

  if (existingMember) {
    throw new ValidationError('User is already a member of this workspace');
  }

  // Check for existing pending invitation
  const existingInvitation = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId,
      email,
      acceptedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (existingInvitation) {
    throw new ValidationError(
      'A pending invitation already exists for this email'
    );
  }

  // Generate token
  const token = generateInvitationToken();

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Create invitation
  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId,
      email,
      token,
      role,
      invitedBy,
      expiresAt,
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
      inviter: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  return invitation;
}

/**
 * Get invitation by token
 * Validates token and checks expiration
 * @param token - Invitation token
 * @returns Invitation if valid
 * @throws NotFoundError if invitation not found or expired
 */
export async function getInvitationByToken(
  token: string
): Promise<WorkspaceInvitation> {
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
      inviter: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new NotFoundError('Invitation');
  }

  // Check if already accepted
  if (invitation.acceptedAt) {
    throw new ValidationError('Invitation has already been accepted');
  }

  // Check if expired
  if (invitation.expiresAt < new Date()) {
    throw new ValidationError('Invitation has expired');
  }

  return invitation;
}

/**
 * Accept workspace invitation
 * Creates WorkspaceMember record and marks invitation as accepted
 * @param token - Invitation token
 * @param userId - User ID accepting the invitation
 * @returns Created workspace member
 */
export async function acceptInvitation(
  token: string,
  userId: string
): Promise<WorkspaceMember> {
  const invitation = await getInvitationByToken(token);

  // Verify user email matches invitation email (optional check - can be relaxed)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  // Note: We allow any user to accept if they have the token
  // In production, you might want to verify email matches
  // if (user.email !== invitation.email) {
  //   throw new ValidationError('Email does not match invitation');
  // }

  // Check if user is already a member
  const existingMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: invitation.workspaceId,
        userId,
      },
    },
  });

  if (existingMember) {
    // Mark invitation as accepted even if already a member
    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    return existingMember;
  }

  // Create workspace member
  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  // Mark invitation as accepted
  await prisma.workspaceInvitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });

  return member;
}

/**
 * Cancel workspace invitation
 * Only inviter or workspace admin/owner can cancel
 * @param invitationId - Invitation ID
 * @param userId - User ID canceling the invitation
 * @returns True if successful
 */
export async function cancelInvitation(
  invitationId: string,
  userId: string
): Promise<boolean> {
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      workspaceId: true,
      invitedBy: true,
    },
  });

  if (!invitation) {
    throw new NotFoundError('Invitation');
  }

  // Check if user is the inviter or has admin/owner permission
  if (invitation.invitedBy !== userId) {
    await checkWorkspacePermission(invitation.workspaceId, userId, 'Admin');
  }

  // Delete invitation
  await prisma.workspaceInvitation.delete({
    where: { id: invitationId },
  });

  return true;
}

/**
 * Get workspace invitations
 * @param workspaceId - Workspace ID
 * @param userId - User ID (for permission check)
 * @returns Array of pending invitations
 */
export async function getWorkspaceInvitations(
  workspaceId: string,
  userId: string
): Promise<WorkspaceInvitation[]> {
  // Verify user has access to workspace
  await checkWorkspaceAccess(workspaceId, userId);

  return prisma.workspaceInvitation.findMany({
    where: {
      workspaceId,
      acceptedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      inviter: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Check if the current user has a pending invitation to a workspace
 * Used to allow invitees to load workspace name for their pending invitations
 * @param workspaceId - Workspace ID
 * @param userId - User ID (current user)
 * @returns True if user has a pending invitation to this workspace
 */
export async function hasPendingInvitationToWorkspace(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) {
    return false;
  }
  const invitation = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId,
      email: user.email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return !!invitation;
}

/**
 * Get pending workspace invitations for the current user (invitee)
 * Returns invitations where email matches current user and not yet accepted
 * @param userId - User ID (current user)
 * @returns Array of pending invitations for this user
 */
export async function getMyPendingInvitations(
  userId: string
): Promise<WorkspaceInvitation[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) {
    return [];
  }
  return prisma.workspaceInvitation.findMany({
    where: {
      email: user.email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
      inviter: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}
