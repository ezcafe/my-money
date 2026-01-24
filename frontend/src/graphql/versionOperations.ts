/**
 * GraphQL Operations for Version History
 * Queries for entity version history
 */

import { gql } from '@apollo/client';

/**
 * Entity version fields fragment
 */
export const ENTITY_VERSION_FIELDS = gql`
  fragment EntityVersionFields on EntityVersion {
    id
    entityType
    entityId
    version
    data
    editedBy
    editedAt
    editor {
      id
      email
    }
  }
`;

/**
 * Get version history for an entity
 */
export const GET_ENTITY_VERSIONS = gql`
  query GetEntityVersions($entityType: String!, $entityId: ID!, $limit: Int) {
    entityVersions(entityType: $entityType, entityId: $entityId, limit: $limit) {
      ...EntityVersionFields
    }
  }
  ${ENTITY_VERSION_FIELDS}
`;
