/**
 * GraphQL Mutations
 *
 * NOTE: For better UX, consider adding optimistic updates to mutations.
 * See frontend/src/utils/optimisticUpdates.ts for helper functions.
 *
 * Example:
 * ```typescript
 * import {createOptimisticResponse} from '../utils/optimisticUpdates';
 *
 * const [createTransaction] = useMutation(CREATE_TRANSACTION, {
 *   optimisticResponse: createOptimisticResponse('createTransaction', {
 *     id: 'temp-' + Date.now(),
 *     value: input.value,
 *     date: input.date,
 *     account: {id: input.accountId, name: '...'},
 *     // ... other fields
 *   }),
 * });
 * ```
 */

import {gql} from '@apollo/client';
import {ACCOUNT_FIELDS, CATEGORY_FIELDS, PAYEE_FIELDS, TRANSACTION_FIELDS, BUDGET_FIELDS, RECURRING_TRANSACTION_FIELDS} from './fragments';

export const CREATE_TRANSACTION = gql`
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
      ...TransactionFields
    }
  }
  ${TRANSACTION_FIELDS}
`;

export const UPDATE_TRANSACTION = gql`
  mutation UpdateTransaction($id: ID!, $input: UpdateTransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      ...TransactionFields
    }
  }
  ${TRANSACTION_FIELDS}
`;

export const DELETE_TRANSACTION = gql`
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(id: $id)
  }
`;

export const CREATE_ACCOUNT = gql`
  mutation CreateAccount($input: CreateAccountInput!) {
    createAccount(input: $input) {
      ...AccountFields
    }
  }
  ${ACCOUNT_FIELDS}
`;

export const UPDATE_PREFERENCES = gql`
  mutation UpdatePreferences($input: UpdatePreferencesInput!) {
    updatePreferences(input: $input) {
      id
      currency
      useThousandSeparator
      colorScheme
      colorSchemeValue
      dateFormat
    }
  }
`;

export const CREATE_RECURRING_TRANSACTION = gql`
  mutation CreateRecurringTransaction($input: CreateRecurringTransactionInput!) {
    createRecurringTransaction(input: $input) {
      ...RecurringTransactionFields
    }
  }
  ${RECURRING_TRANSACTION_FIELDS}
`;

export const UPDATE_ACCOUNT = gql`
  mutation UpdateAccount($id: ID!, $input: UpdateAccountInput!) {
    updateAccount(id: $id, input: $input) {
      ...AccountFields
    }
  }
  ${ACCOUNT_FIELDS}
`;

export const DELETE_ACCOUNT = gql`
  mutation DeleteAccount($id: ID!) {
    deleteAccount(id: $id)
  }
`;

export const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      ...CategoryFields
    }
  }
  ${CATEGORY_FIELDS}
`;

export const UPDATE_CATEGORY = gql`
  mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
    updateCategory(id: $id, input: $input) {
      ...CategoryFields
    }
  }
  ${CATEGORY_FIELDS}
`;

export const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

export const CREATE_PAYEE = gql`
  mutation CreatePayee($input: CreatePayeeInput!) {
    createPayee(input: $input) {
      ...PayeeFields
    }
  }
  ${PAYEE_FIELDS}
`;

export const UPDATE_PAYEE = gql`
  mutation UpdatePayee($id: ID!, $input: UpdatePayeeInput!) {
    updatePayee(id: $id, input: $input) {
      ...PayeeFields
    }
  }
  ${PAYEE_FIELDS}
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

export const UPLOAD_PDF = gql`
  mutation UploadPDF($file: Upload!, $dateFormat: String) {
    uploadPDF(file: $file, dateFormat: $dateFormat) {
      success
      importedCount
      savedCount
      unmappedTransactions {
        id
        rawDate
        rawDescription
        rawDebit
        rawCredit
        suggestedAccountId
        suggestedCategoryId
        suggestedPayeeId
        cardNumber
      }
    }
  }
`;

export const SAVE_IMPORTED_TRANSACTIONS = gql`
  mutation SaveImportedTransactions($mapping: BulkMappingInput!) {
    saveImportedTransactions(mapping: $mapping) {
      success
      savedCount
      errors
    }
  }
`;

export const DELETE_UNMAPPED_IMPORTED_TRANSACTIONS = gql`
  mutation DeleteUnmappedImportedTransactions {
    deleteUnmappedImportedTransactions
  }
`;

export const CREATE_BUDGET = gql`
  mutation CreateBudget($input: CreateBudgetInput!) {
    createBudget(input: $input) {
      ...BudgetFields
    }
  }
  ${BUDGET_FIELDS}
`;

export const UPDATE_BUDGET = gql`
  mutation UpdateBudget($id: ID!, $input: UpdateBudgetInput!) {
    updateBudget(id: $id, input: $input) {
      ...BudgetFields
    }
  }
  ${BUDGET_FIELDS}
`;

export const DELETE_BUDGET = gql`
  mutation DeleteBudget($id: ID!) {
    deleteBudget(id: $id)
  }
`;

export const MARK_BUDGET_NOTIFICATION_READ = gql`
  mutation MarkBudgetNotificationRead($id: ID!) {
    markBudgetNotificationRead(id: $id)
  }
`;







