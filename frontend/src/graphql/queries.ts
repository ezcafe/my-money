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
        type
      }
      payee {
        id
        name
      }
      note
    }
  }
`;

export const GET_TRANSACTIONS = gql`
  query GetTransactions($accountId: ID, $categoryId: ID, $payeeId: ID, $skip: Int, $take: Int, $orderBy: TransactionOrderInput, $note: String) {
    transactions(accountId: $accountId, categoryId: $categoryId, payeeId: $payeeId, skip: $skip, take: $take, orderBy: $orderBy, note: $note) {
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
        }
        payee {
          id
          name
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
      colorScheme
      colorSchemeValue
    }
  }
`;

export const GET_CATEGORIES = gql`
  query GetCategories {
      categories {
        id
        name
        type
        isDefault
      }
  }
`;

export const GET_CATEGORY = gql`
  query GetCategory($id: ID!) {
      category(id: $id) {
        id
        name
        type
        isDefault
      }
  }
`;

export const GET_PAYEES = gql`
  query GetPayees {
      payees {
        id
        name
        isDefault
      }
  }
`;

export const GET_CATEGORIES_AND_PAYEES = gql`
  query GetCategoriesAndPayees {
    categories {
      id
      name
      type
      isDefault
    }
    payees {
      id
      name
      isDefault
    }
  }
`;

export const GET_PAYEE = gql`
  query GetPayee($id: ID!) {
      payee(id: $id) {
        id
        name
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
        type
      }
      payee {
        id
        name
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
          type
        }
        payee {
          id
          name
        }
        note
      }
      totalCount
      totalAmount
      totalIncome
      totalExpense
    }
  }
`;

export const GET_RECURRING_TRANSACTIONS = gql`
  query GetRecurringTransactions {
    recurringTransactions {
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

export const EXPORT_DATA = gql`
  query ExportData {
    exportData {
      accounts {
        id
        name
        initBalance
        isDefault
      }
      categories {
        id
        name
        type
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
      preferences {
        id
        currency
        useThousandSeparator
        colorScheme
        colorSchemeValue
      }
      budgets {
        id
        userId
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
      id
      userId
      amount
      currentSpent
      accountId
      categoryId
      payeeId
      account {
        id
        name
      }
      category {
        id
        name
        type
      }
      payee {
        id
        name
      }
      percentageUsed
      lastResetDate
      createdAt
      updatedAt
    }
  }
`;

export const GET_BUDGET = gql`
  query GetBudget($id: ID!) {
    budget(id: $id) {
      id
      userId
      amount
      currentSpent
      accountId
      categoryId
      payeeId
      account {
        id
        name
      }
      category {
        id
        name
        type
      }
      payee {
        id
        name
      }
      percentageUsed
      lastResetDate
      createdAt
      updatedAt
    }
  }
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







