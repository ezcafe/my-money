/**
 * GraphQL Queries
 */

import {gql} from '@apollo/client';

export const GET_ACCOUNTS = gql`
  query GetAccounts {
    accounts {
      id
      name
      initBalance
      isDefault
      balance
    }
  }
`;

export const GET_ACCOUNT = gql`
  query GetAccount($id: ID!) {
    account(id: $id) {
      id
      name
      initBalance
      isDefault
      balance
    }
  }
`;

export const GET_RECENT_TRANSACTIONS = gql`
  query GetRecentTransactions($limit: Int, $orderBy: TransactionOrderInput) {
    recentTransactions(limit: $limit, orderBy: $orderBy) {
      id
      value
      date
      account {
        id
        name
      }
      category {
        id
        name
        icon
      }
      payee {
        id
        name
        icon
      }
      note
    }
  }
`;

export const GET_TRANSACTIONS = gql`
  query GetTransactions($accountId: ID, $skip: Int, $take: Int, $orderBy: TransactionOrderInput, $note: String) {
    transactions(accountId: $accountId, skip: $skip, take: $take, orderBy: $orderBy, note: $note) {
      items {
        id
        value
        date
        account {
          id
          name
        }
        category {
          id
          name
          icon
        }
        payee {
          id
          name
          icon
        }
        note
      }
      totalCount
      hasMore
      nextCursor
    }
  }
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

export const GET_PREFERENCES = gql`
  query GetPreferences {
    preferences {
      id
      currency
      useThousandSeparator
    }
  }
`;

export const GET_CATEGORIES = gql`
  query GetCategories {
    categories {
      id
      name
      icon
      isDefault
    }
  }
`;

export const GET_PAYEES = gql`
  query GetPayees {
    payees {
      id
      name
      icon
      isDefault
    }
  }
`;

export const GET_TRANSACTION = gql`
  query GetTransaction($id: ID!) {
    transaction(id: $id) {
      id
      value
      date
      account {
        id
        name
      }
      category {
        id
        name
        icon
      }
      payee {
        id
        name
        icon
      }
      note
    }
  }
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
        id
        value
        date
        account {
          id
          name
        }
        category {
          id
          name
          icon
        }
        payee {
          id
          name
          icon
        }
        note
      }
      totalCount
      totalAmount
    }
  }
`;







