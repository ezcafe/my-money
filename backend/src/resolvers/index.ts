/**
 * Resolver exports
 */

/* eslint-disable @typescript-eslint/no-unsafe-return */
import {AccountResolver} from './AccountResolver';
import {TransactionResolver} from './TransactionResolver';
import {UserResolver} from './UserResolver';
import {CategoryResolver} from './CategoryResolver';
import {PayeeResolver} from './PayeeResolver';
import {PreferencesResolver} from './PreferencesResolver';
import {RecurringTransactionResolver} from './RecurringTransactionResolver';
import {ReportResolver} from './ReportResolver';
import {uploadPDF, matchImportedTransaction} from './ImportResolver';
import type {GraphQLContext} from '../middleware/context';

export const resolvers = {
  Query: {
    // User queries
    me: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new UserResolver().me(parent, args, context),

    // Account queries
    accounts: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new AccountResolver().accounts(parent, args, context),
    account: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new AccountResolver().account(parent, args as {id: string}, context),
    accountBalance: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new AccountResolver().accountBalance(parent, args as {accountId: string}, context),

    // Transaction queries
    transactions: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new TransactionResolver().transactions(
        parent,
        args as {
          accountId?: string;
          skip?: number;
          take?: number;
          first?: number;
          after?: string;
          orderBy?: {field: 'date' | 'value' | 'category' | 'account' | 'payee'; direction: 'asc' | 'desc'};
          note?: string;
        },
        context,
      ),
    recentTransactions: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new TransactionResolver().recentTransactions(parent, args as {limit?: number}, context),
    transaction: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new TransactionResolver().transaction(parent, args as {id: string}, context),
    topUsedValues: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new TransactionResolver().topUsedValues(parent, args as {days?: number}, context),

    // Category queries
    categories: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new CategoryResolver().categories(parent, args, context),
    category: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new CategoryResolver().category(parent, args as {id: string}, context),

    // Payee queries
    payees: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new PayeeResolver().payees(parent, args, context),
    payee: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new PayeeResolver().payee(parent, args as {id: string}, context),

    // Preferences queries
    preferences: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new PreferencesResolver().preferences(parent, args, context),

    // Recurring transaction queries
    recurringTransactions: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new RecurringTransactionResolver().recurringTransactions(parent, args, context),

    // Report queries
    reportTransactions: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new ReportResolver().reportTransactions(
        parent,
        args as {
          accountIds?: string[];
          categoryIds?: string[];
          payeeIds?: string[];
          startDate?: Date;
          endDate?: Date;
          skip?: number;
          take?: number;
        },
        context,
      ),
  },
  Mutation: {
    // Account mutations
    createAccount: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new AccountResolver().createAccount(parent, args as {input: {name: string; initBalance?: number}}, context),
    updateAccount: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new AccountResolver().updateAccount(parent, args as {id: string; input: {name?: string; initBalance?: number}}, context),
    deleteAccount: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new AccountResolver().deleteAccount(parent, args as {id: string}, context),

    // Transaction mutations
    createTransaction: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new TransactionResolver().createTransaction(parent, args as {input: unknown}, context),
    updateTransaction: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new TransactionResolver().updateTransaction(parent, args as {id: string; input: unknown}, context),
    deleteTransaction: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new TransactionResolver().deleteTransaction(parent, args as {id: string}, context),

    // Category mutations
    createCategory: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new CategoryResolver().createCategory(parent, args as {input: {name: string; icon?: string | null}}, context),
    updateCategory: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new CategoryResolver().updateCategory(parent, args as {id: string; input: {name?: string; icon?: string | null}}, context),
    deleteCategory: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new CategoryResolver().deleteCategory(parent, args as {id: string}, context),

    // Payee mutations
    createPayee: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new PayeeResolver().createPayee(parent, args as {input: {name: string; icon?: string | null}}, context),
    updatePayee: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new PayeeResolver().updatePayee(parent, args as {id: string; input: {name?: string; icon?: string | null}}, context),
    deletePayee: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new PayeeResolver().deletePayee(parent, args as {id: string}, context),

    // Preferences mutations
    updatePreferences: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new PreferencesResolver().updatePreferences(parent, args as {input: {currency?: string; useThousandSeparator?: boolean}}, context),

    // Recurring transaction mutations
    createRecurringTransaction: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new RecurringTransactionResolver().createRecurringTransaction(
        parent,
        args as {
          input: {
            cronExpression: string;
            value: number;
            accountId: string;
            categoryId?: string | null;
            payeeId?: string | null;
            note?: string | null;
            nextRunDate: Date;
          };
        },
        context,
      ),
    updateRecurringTransaction: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new RecurringTransactionResolver().updateRecurringTransaction(
        parent,
        args as {
          id: string;
          input: {
            cronExpression?: string;
            value?: number;
            accountId?: string;
            categoryId?: string | null;
            payeeId?: string | null;
            note?: string | null;
            nextRunDate?: Date;
          };
        },
        context,
      ),
    deleteRecurringTransaction: (parent: unknown, args: unknown, context: GraphQLContext) =>
      new RecurringTransactionResolver().deleteRecurringTransaction(parent, args as {id: string}, context),

    // Import mutations
    uploadPDF: (parent: unknown, args: unknown, context: GraphQLContext) =>
      uploadPDF(
        parent,
        args as {
          file: Promise<{
            filename: string;
            mimetype?: string;
            encoding?: string;
            createReadStream: () => NodeJS.ReadableStream;
          }>;
        },
        context,
      ),
    matchImportedTransaction: (parent: unknown, args: unknown, context: GraphQLContext) =>
      matchImportedTransaction(parent, args as {importedId: string; transactionId: string}, context),
  },
  Account: {
    balance: async (parent: {id: string}, _: unknown, context: GraphQLContext) => {
      return context.accountBalanceLoader.load(parent.id);
    },
  },
  Transaction: {
    category: async (parent: {categoryId: string | null}, _: unknown, context: GraphQLContext) => {
      if (!parent.categoryId) return null;
      return context.categoryLoader.load(parent.categoryId);
    },
    payee: async (parent: {payeeId: string | null}, _: unknown, context: GraphQLContext) => {
      if (!parent.payeeId) return null;
      return context.payeeLoader.load(parent.payeeId);
    },
    account: async (parent: {accountId: string}, _: unknown, context: GraphQLContext) => {
      return context.accountLoader.load(parent.accountId);
    },
  },
  RecurringTransaction: {
    category: async (parent: {categoryId: string | null}, _: unknown, context: GraphQLContext) => {
      if (!parent.categoryId) return null;
      return context.categoryLoader.load(parent.categoryId);
    },
    payee: async (parent: {payeeId: string | null}, _: unknown, context: GraphQLContext) => {
      if (!parent.payeeId) return null;
      return context.payeeLoader.load(parent.payeeId);
    },
    account: async (parent: {accountId: string}, _: unknown, context: GraphQLContext) => {
      return context.accountLoader.load(parent.accountId);
    },
  },
};


