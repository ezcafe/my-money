/**
 * GraphQL Fragments
 * Reusable field selections for queries and mutations
 */

import { gql } from '@apollo/client';

/**
 * Account fields fragment
 */
export const ACCOUNT_FIELDS = gql`
  fragment AccountFields on Account {
    id
    name
    initBalance
    isDefault
    accountType
    balance
  }
`;

/**
 * Category fields fragment
 */
export const CATEGORY_FIELDS = gql`
  fragment CategoryFields on Category {
    id
    name
    categoryType
    isDefault
  }
`;

/**
 * Payee fields fragment
 */
export const PAYEE_FIELDS = gql`
  fragment PayeeFields on Payee {
    id
    name
    isDefault
  }
`;

/**
 * Transaction fields fragment
 * Includes related account, category, and payee
 */
export const TRANSACTION_FIELDS = gql`
  fragment TransactionFields on Transaction {
    id
    value
    date
    account {
      ...AccountFields
    }
    category {
      ...CategoryFields
    }
    payee {
      ...PayeeFields
    }
    note
  }
  ${ACCOUNT_FIELDS}
  ${CATEGORY_FIELDS}
  ${PAYEE_FIELDS}
`;

/**
 * Budget fields fragment
 * Includes related account, category, and payee
 */
export const BUDGET_FIELDS = gql`
  fragment BudgetFields on Budget {
    id
    amount
    currentSpent
    accountId
    categoryId
    payeeId
    account {
      ...AccountFields
    }
    category {
      ...CategoryFields
    }
    payee {
      ...PayeeFields
    }
    percentageUsed
    lastResetDate
    createdAt
    updatedAt
  }
  ${ACCOUNT_FIELDS}
  ${CATEGORY_FIELDS}
  ${PAYEE_FIELDS}
`;

/**
 * Recurring transaction fields fragment
 */
export const RECURRING_TRANSACTION_FIELDS = gql`
  fragment RecurringTransactionFields on RecurringTransaction {
    id
    cronExpression
    value
    accountId
    account {
      ...AccountFields
    }
    categoryId
    category {
      ...CategoryFields
    }
    payeeId
    payee {
      ...PayeeFields
    }
    note
    nextRunDate
    userId
    createdAt
    updatedAt
  }
  ${ACCOUNT_FIELDS}
  ${CATEGORY_FIELDS}
  ${PAYEE_FIELDS}
`;
