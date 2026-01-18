/**
 * GraphQL Subscriptions
 * Real-time subscriptions for entity updates
 */

import {gql} from '@apollo/client';
import {ACCOUNT_FIELDS, CATEGORY_FIELDS, PAYEE_FIELDS, TRANSACTION_FIELDS} from './fragments';

/**
 * Subscribe to account updates
 */
export const ACCOUNT_UPDATED_SUBSCRIPTION = gql`
  subscription AccountUpdated($workspaceId: ID!) {
    accountUpdated(workspaceId: $workspaceId) {
      ...AccountFields
    }
  }
  ${ACCOUNT_FIELDS}
`;

/**
 * Subscribe to category updates
 */
export const CATEGORY_UPDATED_SUBSCRIPTION = gql`
  subscription CategoryUpdated($workspaceId: ID!) {
    categoryUpdated(workspaceId: $workspaceId) {
      ...CategoryFields
    }
  }
  ${CATEGORY_FIELDS}
`;

/**
 * Subscribe to payee updates
 */
export const PAYEE_UPDATED_SUBSCRIPTION = gql`
  subscription PayeeUpdated($workspaceId: ID!) {
    payeeUpdated(workspaceId: $workspaceId) {
      ...PayeeFields
    }
  }
  ${PAYEE_FIELDS}
`;

/**
 * Subscribe to transaction updates
 */
export const TRANSACTION_UPDATED_SUBSCRIPTION = gql`
  subscription TransactionUpdated($workspaceId: ID!) {
    transactionUpdated(workspaceId: $workspaceId) {
      ...TransactionFields
    }
  }
  ${TRANSACTION_FIELDS}
`;
