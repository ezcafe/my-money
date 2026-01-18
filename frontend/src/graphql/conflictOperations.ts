/**
 * GraphQL Operations for Conflict Resolution
 * Queries and mutations for entity conflicts
 */

import {gql} from '@apollo/client';

/**
 * Entity conflict fields fragment
 */
export const ENTITY_CONFLICT_FIELDS = gql`
  fragment EntityConflictFields on EntityConflict {
    id
    entityType
    entityId
    currentVersion
    incomingVersion
    currentData
    incomingData
    workspaceId
    detectedAt
    resolvedAt
    resolvedBy
    resolvedVersion
    resolver {
      id
      email
    }
  }
`;

/**
 * Get unresolved conflicts for a workspace
 */
export const GET_ENTITY_CONFLICTS = gql`
  query GetEntityConflicts($workspaceId: ID!) {
    entityConflicts(workspaceId: $workspaceId) {
      ...EntityConflictFields
    }
  }
  ${ENTITY_CONFLICT_FIELDS}
`;

/**
 * Get conflict by ID
 */
export const GET_ENTITY_CONFLICT = gql`
  query GetEntityConflict($id: ID!) {
    entityConflict(id: $id) {
      ...EntityConflictFields
    }
  }
  ${ENTITY_CONFLICT_FIELDS}
`;

/**
 * Resolve a conflict by choosing a version
 */
export const RESOLVE_CONFLICT = gql`
  mutation ResolveConflict($conflictId: ID!, $chosenVersion: Int!, $mergeData: JSON) {
    resolveConflict(conflictId: $conflictId, chosenVersion: $chosenVersion, mergeData: $mergeData) {
      ...EntityConflictFields
    }
  }
  ${ENTITY_CONFLICT_FIELDS}
`;

/**
 * Dismiss a conflict (use current version)
 */
export const DISMISS_CONFLICT = gql`
  mutation DismissConflict($conflictId: ID!) {
    dismissConflict(conflictId: $conflictId)
  }
`;

/**
 * Subscription for conflict detection
 */
export const ENTITY_CONFLICT_DETECTED_SUBSCRIPTION = gql`
  subscription EntityConflictDetected($workspaceId: ID!) {
    entityConflictDetected(workspaceId: $workspaceId) {
      ...EntityConflictFields
    }
  }
  ${ENTITY_CONFLICT_FIELDS}
`;
