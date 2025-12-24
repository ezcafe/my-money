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

export const CREATE_RECURRING_TRANSACTION = gql`
  mutation CreateRecurringTransaction($input: CreateRecurringTransactionInput!) {
    createRecurringTransaction(input: $input) {
      id
      cronExpression
      value
      accountId
      account {
        id
        name
      }
      categoryId
      category {
        id
        name
        type
      }
      payeeId
      payee {
        id
        name
      }
      note
      nextRunDate
      userId
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_ACCOUNT = gql`
  mutation UpdateAccount($id: ID!, $input: UpdateAccountInput!) {
    updateAccount(id: $id, input: $input) {
      id
      name
      initBalance
      isDefault
      balance
    }
  }
`;

export const DELETE_ACCOUNT = gql`
  mutation DeleteAccount($id: ID!) {
    deleteAccount(id: $id)
  }
`;

export const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
      createCategory(input: $input) {
        id
        name
        type
        isDefault
      }
  }
`;

export const UPDATE_CATEGORY = gql`
  mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
      updateCategory(id: $id, input: $input) {
        id
        name
        type
        isDefault
      }
  }
`;

export const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

export const CREATE_PAYEE = gql`
  mutation CreatePayee($input: CreatePayeeInput!) {
      createPayee(input: $input) {
        id
        name
        isDefault
      }
  }
`;

export const UPDATE_PAYEE = gql`
  mutation UpdatePayee($id: ID!, $input: UpdatePayeeInput!) {
      updatePayee(id: $id, input: $input) {
        id
        name
        isDefault
      }
  }
`;

export const DELETE_PAYEE = gql`
  mutation DeletePayee($id: ID!) {
    deletePayee(id: $id)
  }
`;

export const IMPORT_CSV = gql`
  mutation ImportCSV($file: Upload!, $entityType: String!) {
    importCSV(file: $file, entityType: $entityType) {
      success
      created
      updated
      errors
    }
  }
`;

export const RESET_DATA = gql`
  mutation ResetData {
    resetData
  }
`;







