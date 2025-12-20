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
  query GetRecentTransactions($limit: Int) {
    recentTransactions(limit: $limit) {
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
  query GetTransactions($accountId: ID, $skip: Int, $take: Int) {
    transactions(accountId: $accountId, skip: $skip, take: $take) {
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







