/**
 * GraphQL Queries
 */

import { gql } from '@apollo/client';
import {
  ACCOUNT_FIELDS,
  CATEGORY_FIELDS,
  PAYEE_FIELDS,
  TRANSACTION_FIELDS,
  BUDGET_FIELDS,
  RECURRING_TRANSACTION_FIELDS,
} from './fragments';

export const GET_ACCOUNTS = gql`
  query GetAccounts {
    accounts {
      ...AccountFields
    }
  }
  ${ACCOUNT_FIELDS}
`;

export const GET_ACCOUNT = gql`
  query GetAccount($id: ID!) {
    account(id: $id) {
      ...AccountFields
    }
  }
  ${ACCOUNT_FIELDS}
`;

export const GET_RECENT_TRANSACTIONS = gql`
  query GetRecentTransactions($limit: Int, $orderBy: TransactionOrderInput) {
    recentTransactions(limit: $limit, orderBy: $orderBy) {
      ...TransactionFields
    }
  }
  ${TRANSACTION_FIELDS}
`;

export const GET_TRANSACTIONS = gql`
  query GetTransactions(
    $accountId: ID
    $categoryId: ID
    $payeeId: ID
    $first: Int
    $after: String
    $orderBy: TransactionOrderInput
    $note: String
  ) {
    transactions(
      accountId: $accountId
      categoryId: $categoryId
      payeeId: $payeeId
      first: $first
      after: $after
      orderBy: $orderBy
      note: $note
    ) {
      items {
        ...TransactionFields
      }
      totalCount
      hasMore
      nextCursor
    }
  }
  ${TRANSACTION_FIELDS}
`;

export const GET_ACCOUNT_BALANCE = gql`
  query GetAccountBalance($accountId: ID!) {
    accountBalance(accountId: $accountId)
  }
`;

export const GET_TOP_USED_VALUES = gql`
  query GetTopUsedValues($days: Int) {
    topUsedValues(days: $days) {
      value
      count
    }
  }
`;

export const GET_MOST_USED_TRANSACTION_DETAILS = gql`
  query GetMostUsedTransactionDetails($amount: Decimal!, $days: Int) {
    mostUsedTransactionDetails(amount: $amount, days: $days) {
      accountId
      payeeId
      categoryId
      count
    }
  }
`;

export const GET_SETTINGS = gql`
  query GetSettings {
    settings {
      id
      currency
      useThousandSeparator
      colorScheme
      colorSchemeValue
      dateFormat
      keypadLayout
    }
  }
`;

export const GET_CATEGORIES = gql`
  query GetCategories {
    categories {
      ...CategoryFields
    }
  }
  ${CATEGORY_FIELDS}
`;

export const GET_CATEGORY = gql`
  query GetCategory($id: ID!) {
    category(id: $id) {
      ...CategoryFields
    }
  }
  ${CATEGORY_FIELDS}
`;

export const GET_PAYEES = gql`
  query GetPayees {
    payees {
      ...PayeeFields
    }
  }
  ${PAYEE_FIELDS}
`;

export const GET_CATEGORIES_AND_PAYEES = gql`
  query GetCategoriesAndPayees {
    categories {
      ...CategoryFields
    }
    payees {
      ...PayeeFields
    }
  }
  ${CATEGORY_FIELDS}
  ${PAYEE_FIELDS}
`;

export const GET_PAYEE = gql`
  query GetPayee($id: ID!) {
    payee(id: $id) {
      ...PayeeFields
    }
  }
  ${PAYEE_FIELDS}
`;

export const GET_TRANSACTION = gql`
  query GetTransaction($id: ID!) {
    transaction(id: $id) {
      ...TransactionFields
    }
  }
  ${TRANSACTION_FIELDS}
`;

export const GET_REPORT_TRANSACTIONS = gql`
  query GetReportTransactions(
    $accountIds: [ID!]
    $categoryIds: [ID!]
    $payeeIds: [ID!]
    $startDate: DateTime
    $endDate: DateTime
    $note: String
    $orderBy: TransactionOrderInput
    $skip: Int
    $take: Int
  ) {
    reportTransactions(
      accountIds: $accountIds
      categoryIds: $categoryIds
      payeeIds: $payeeIds
      startDate: $startDate
      endDate: $endDate
      note: $note
      orderBy: $orderBy
      skip: $skip
      take: $take
    ) {
      items {
        ...TransactionFields
      }
      totalCount
      totalAmount
      totalIncome
      totalExpense
    }
  }
  ${TRANSACTION_FIELDS}
`;

export const GET_RECURRING_TRANSACTIONS = gql`
  query GetRecurringTransactions {
    recurringTransactions {
      ...RecurringTransactionFields
    }
  }
  ${RECURRING_TRANSACTION_FIELDS}
`;

export const EXPORT_DATA = gql`
  query ExportData($memberIds: [ID!]) {
    exportData(memberIds: $memberIds) {
      accounts {
        id
        name
        initBalance
        isDefault
      }
      categories {
        id
        name
        categoryType
        isDefault
      }
      payees {
        id
        name
        isDefault
      }
      transactions {
        id
        value
        date
        accountId
        categoryId
        payeeId
        note
      }
      recurringTransactions {
        id
        cronExpression
        value
        accountId
        categoryId
        payeeId
        note
        nextRunDate
      }
      settings {
        id
        currency
        useThousandSeparator
        colorScheme
        colorSchemeValue
      }
      budgets {
        id
        amount
        currentSpent
        accountId
        categoryId
        payeeId
        lastResetDate
        createdAt
        updatedAt
      }
      importMatchRules {
        id
        pattern
        accountId
        categoryId
        payeeId
        userId
        createdAt
        updatedAt
      }
    }
  }
`;

export const GET_BUDGETS = gql`
  query GetBudgets {
    budgets {
      ...BudgetFields
    }
  }
  ${BUDGET_FIELDS}
`;

export const GET_BUDGET = gql`
  query GetBudget($id: ID!) {
    budget(id: $id) {
      ...BudgetFields
    }
  }
  ${BUDGET_FIELDS}
`;

export const GET_BUDGET_NOTIFICATIONS = gql`
  query GetBudgetNotifications {
    budgetNotifications {
      id
      userId
      budgetId
      budget {
        id
        amount
        currentSpent
        account {
          id
          name
        }
        category {
          id
          name
        }
        payee {
          id
          name
        }
        percentageUsed
      }
      threshold
      message
      createdAt
    }
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      oidcSubject
      createdAt
      updatedAt
    }
  }
`;
