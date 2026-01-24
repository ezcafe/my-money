/**
 * GraphQL Operations for Workspace Management
 * Queries and mutations for workspaces, members, and invitations
 */

import { gql } from '@apollo/client';

/**
 * Workspace fields fragment
 */
export const WORKSPACE_FIELDS = gql`
  fragment WorkspaceFields on Workspace {
    id
    name
    createdAt
    updatedAt
    members {
      id
      userId
      role
      joinedAt
      user {
        id
        email
      }
    }
    invitations {
      id
      email
      role
      invitedBy
      expiresAt
      acceptedAt
      createdAt
      inviter {
        id
        email
      }
    }
  }
`;

/**
 * Workspace member fields fragment
 */
export const WORKSPACE_MEMBER_FIELDS = gql`
  fragment WorkspaceMemberFields on WorkspaceMember {
    id
    workspaceId
    userId
    role
    joinedAt
    user {
      id
      email
    }
    workspace {
      id
      name
    }
  }
`;

/**
 * Workspace invitation fields fragment
 */
export const WORKSPACE_INVITATION_FIELDS = gql`
  fragment WorkspaceInvitationFields on WorkspaceInvitation {
    id
    workspaceId
    email
    token
    role
    invitedBy
    expiresAt
    acceptedAt
    createdAt
    workspace {
      id
      name
    }
    inviter {
      id
      email
    }
  }
`;

/**
 * Get all workspaces the current user belongs to
 */
export const GET_WORKSPACES = gql`
  query GetWorkspaces {
    workspaces {
      id
      name
      createdAt
      updatedAt
      _count {
        members
        accounts
        transactions
      }
    }
  }
`;

/**
 * Get workspace by ID
 */
export const GET_WORKSPACE = gql`
  query GetWorkspace($id: ID!) {
    workspace(id: $id) {
      id
      name
      createdAt
      updatedAt
      _count {
        members
        accounts
        transactions
      }
    }
  }
`;

/**
 * Get workspace members
 */
export const GET_WORKSPACE_MEMBERS = gql`
  query GetWorkspaceMembers($workspaceId: ID!) {
    workspaceMembers(workspaceId: $workspaceId) {
      ...WorkspaceMemberFields
    }
  }
  ${WORKSPACE_MEMBER_FIELDS}
`;

/**
 * Get workspace invitations
 */
export const GET_WORKSPACE_INVITATIONS = gql`
  query GetWorkspaceInvitations($workspaceId: ID!) {
    workspaceInvitations(workspaceId: $workspaceId) {
      ...WorkspaceInvitationFields
    }
  }
  ${WORKSPACE_INVITATION_FIELDS}
`;

/**
 * Get invitation by token (public, for viewing invitation details)
 */
export const GET_INVITATION_BY_TOKEN = gql`
  query GetInvitationByToken($token: String!) {
    invitationByToken(token: $token) {
      ...WorkspaceInvitationFields
    }
  }
  ${WORKSPACE_INVITATION_FIELDS}
`;

/**
 * Create a new workspace
 */
export const CREATE_WORKSPACE = gql`
  mutation CreateWorkspace($name: String!) {
    createWorkspace(name: $name) {
      id
      name
      createdAt
      updatedAt
    }
  }
`;

/**
 * Update workspace
 */
export const UPDATE_WORKSPACE = gql`
  mutation UpdateWorkspace($id: ID!, $name: String) {
    updateWorkspace(id: $id, name: $name) {
      id
      name
      updatedAt
    }
  }
`;

/**
 * Delete workspace
 */
export const DELETE_WORKSPACE = gql`
  mutation DeleteWorkspace($id: ID!) {
    deleteWorkspace(id: $id)
  }
`;

/**
 * Invite user to workspace
 */
export const INVITE_USER_TO_WORKSPACE = gql`
  mutation InviteUserToWorkspace($workspaceId: ID!, $email: String!, $role: WorkspaceRole) {
    inviteUserToWorkspace(workspaceId: $workspaceId, email: $email, role: $role) {
      ...WorkspaceInvitationFields
    }
  }
  ${WORKSPACE_INVITATION_FIELDS}
`;

/**
 * Accept workspace invitation
 */
export const ACCEPT_WORKSPACE_INVITATION = gql`
  mutation AcceptWorkspaceInvitation($token: String!) {
    acceptWorkspaceInvitation(token: $token) {
      ...WorkspaceMemberFields
    }
  }
  ${WORKSPACE_MEMBER_FIELDS}
`;

/**
 * Cancel workspace invitation
 */
export const CANCEL_WORKSPACE_INVITATION = gql`
  mutation CancelWorkspaceInvitation($invitationId: ID!) {
    cancelWorkspaceInvitation(invitationId: $invitationId)
  }
`;

/**
 * Update workspace member role
 */
export const UPDATE_WORKSPACE_MEMBER_ROLE = gql`
  mutation UpdateWorkspaceMemberRole($workspaceId: ID!, $memberId: ID!, $role: WorkspaceRole!) {
    updateWorkspaceMemberRole(workspaceId: $workspaceId, memberId: $memberId, role: $role) {
      ...WorkspaceMemberFields
    }
  }
  ${WORKSPACE_MEMBER_FIELDS}
`;

/**
 * Remove workspace member
 */
export const REMOVE_WORKSPACE_MEMBER = gql`
  mutation RemoveWorkspaceMember($workspaceId: ID!, $memberId: ID!) {
    removeWorkspaceMember(workspaceId: $workspaceId, memberId: $memberId)
  }
`;
