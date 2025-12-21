/**
 * GraphQL Mutations
 */

import {gql} from '@apollo/client';

export const CREATE_TRANSACTION = gql`
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
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
      }
      payee {
        id
        name
      }
      note
    }
  }
`;

export const UPDATE_TRANSACTION = gql`
  mutation UpdateTransaction($id: ID!, $input: UpdateTransactionInput!) {
    updateTransaction(id: $id, input: $input) {
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
      }
      payee {
        id
        name
      }
      note
    }
  }
`;

export const DELETE_TRANSACTION = gql`
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(id: $id)
  }
`;

export const CREATE_ACCOUNT = gql`
  mutation CreateAccount($input: CreateAccountInput!) {
    createAccount(input: $input) {
      id
      name
      initBalance
      isDefault
      balance
    }
  }
`;

export const UPDATE_PREFERENCES = gql`
  mutation UpdatePreferences($input: UpdatePreferencesInput!) {
    updatePreferences(input: $input) {
      id
      currency
      useThousandSeparator
    }
  }
`;







