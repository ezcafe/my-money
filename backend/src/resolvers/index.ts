/**
 * Resolver exports
 * Note: Return types are inferred from resolver methods
 */

/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types */
import { AccountResolver } from './AccountResolver';
import { TransactionResolver } from './TransactionResolver';
import { UserResolver } from './UserResolver';
import { CategoryResolver } from './CategoryResolver';
import { PayeeResolver } from './PayeeResolver';
import { PreferencesResolver } from './PreferencesResolver';
import { RecurringTransactionResolver } from './RecurringTransactionResolver';
import { ReportResolver } from './ReportResolver';
import { ExportResolver } from './ExportResolver';
import { ResetDataResolver } from './ResetDataResolver';
import { ExampleDataResolver } from './ExampleDataResolver';
import { BudgetResolver } from './BudgetResolver';
import { SubscriptionResolver } from './SubscriptionResolver';
import { WorkspaceResolver } from './WorkspaceResolver';
import { ConflictResolver } from './ConflictResolver';
import { BatchResolver } from './BatchResolver';
import {
  uploadPDF,
  matchImportedTransaction,
  importCSV,
  saveImportedTransactions,
  deleteUnmappedImportedTransactions,
} from './ImportResolver';
import type { GraphQLContext } from '../middleware/context';
import type {
  Transaction,
  Account,
  Category,
  Payee,
  Budget,
} from '@prisma/client';

// Create resolver instances once (singleton pattern)
// This reduces object creation overhead and allows for better state management if needed
const userResolver = new UserResolver();
const accountResolver = new AccountResolver();
const transactionResolver = new TransactionResolver();
const categoryResolver = new CategoryResolver();
const payeeResolver = new PayeeResolver();
const preferencesResolver = new PreferencesResolver();
const recurringTransactionResolver = new RecurringTransactionResolver();
const reportResolver = new ReportResolver();
const exportResolver = new ExportResolver();
const resetDataResolver = new ResetDataResolver();
const exampleDataResolver = new ExampleDataResolver();
const budgetResolver = new BudgetResolver();
const subscriptionResolver = new SubscriptionResolver();
const workspaceResolver = new WorkspaceResolver();
const conflictResolver = new ConflictResolver();
const batchResolver = new BatchResolver();

export const resolvers = {
  Query: {
    // User queries
    me: (parent: unknown, args: unknown, context: GraphQLContext) =>
      userResolver.me(parent, args, context),

    // Account queries
    accounts: (parent: unknown, args: unknown, context: GraphQLContext) =>
      accountResolver.accounts(parent, args, context),
    account: (parent: unknown, args: unknown, context: GraphQLContext) =>
      accountResolver.account(parent, args as { id: string }, context),
    accountBalance: (parent: unknown, args: unknown, context: GraphQLContext) =>
      accountResolver.accountBalance(
        parent,
        args as { accountId: string },
        context
      ),

    // Transaction queries
    transactions: (parent: unknown, args: unknown, context: GraphQLContext) =>
      transactionResolver.transactions(
        parent,
        args as {
          accountId?: string;
          skip?: number;
          take?: number;
          first?: number;
          after?: string;
          orderBy?: {
            field: 'date' | 'value' | 'category' | 'account' | 'payee';
            direction: 'asc' | 'desc';
          };
          note?: string;
        },
        context
      ),
    recentTransactions: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      transactionResolver.recentTransactions(
        parent,
        args as { limit?: number },
        context
      ),
    transaction: (parent: unknown, args: unknown, context: GraphQLContext) =>
      transactionResolver.transaction(parent, args as { id: string }, context),
    topUsedValues: (parent: unknown, args: unknown, context: GraphQLContext) =>
      transactionResolver.topUsedValues(
        parent,
        args as { days?: number },
        context
      ),
    mostUsedTransactionDetails: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      transactionResolver.mostUsedTransactionDetails(
        parent,
        args as { amount: number; days?: number },
        context
      ),

    // Category queries
    categories: (parent: unknown, args: unknown, context: GraphQLContext) =>
      categoryResolver.categories(parent, args, context),
    category: (parent: unknown, args: unknown, context: GraphQLContext) =>
      categoryResolver.category(parent, args as { id: string }, context),

    // Payee queries
    payees: (parent: unknown, args: unknown, context: GraphQLContext) =>
      payeeResolver.payees(parent, args, context),
    payee: (parent: unknown, args: unknown, context: GraphQLContext) =>
      payeeResolver.payee(parent, args as { id: string }, context),

    // Preferences queries
    preferences: (parent: unknown, args: unknown, context: GraphQLContext) =>
      preferencesResolver.preferences(parent, args, context),

    // Recurring transaction queries
    recurringTransactions: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      recurringTransactionResolver.recurringTransactions(parent, args, context),

    // Report queries
    reportTransactions: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      reportResolver.reportTransactions(
        parent,
        args as {
          accountIds?: string[];
          categoryIds?: string[];
          payeeIds?: string[];
          startDate?: Date;
          endDate?: Date;
          note?: string;
          orderBy?: { field: string; direction: string };
          skip?: number;
          take?: number;
        },
        context
      ),

    // Export queries
    exportData: (parent: unknown, args: unknown, context: GraphQLContext) =>
      exportResolver.exportData(
        parent,
        args as {
          startDate?: Date;
          endDate?: Date;
          accountIds?: string[];
          categoryIds?: string[];
          payeeIds?: string[];
          includeTransactions?: boolean;
          includeRecurringTransactions?: boolean;
          includeBudgets?: boolean;
        },
        context
      ),

    // Budget queries
    budgets: (parent: unknown, args: unknown, context: GraphQLContext) =>
      budgetResolver.budgets(parent, args, context),
    budget: (parent: unknown, args: unknown, context: GraphQLContext) =>
      budgetResolver.budget(parent, args as { id: string }, context),
    budgetNotifications: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) => budgetResolver.budgetNotifications(parent, args, context),

    // Workspace queries
    workspaces: (parent: unknown, args: unknown, context: GraphQLContext) =>
      workspaceResolver.workspaces(parent, args, context),
    workspace: (parent: unknown, args: unknown, context: GraphQLContext) =>
      workspaceResolver.workspace(parent, args as { id: string }, context),
    workspaceMembers: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      workspaceResolver.workspaceMembers(
        parent,
        args as { workspaceId: string },
        context
      ),
    workspaceInvitations: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      workspaceResolver.workspaceInvitations(
        parent,
        args as { workspaceId: string },
        context
      ),
    invitationByToken: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      workspaceResolver.invitationByToken(
        parent,
        args as { token: string },
        context
      ),

    // Conflict queries
    entityConflicts: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      conflictResolver.entityConflicts(
        parent,
        args as { workspaceId: string },
        context
      ),
    entityConflict: (parent: unknown, args: unknown, context: GraphQLContext) =>
      conflictResolver.entityConflict(parent, args as { id: string }, context),
    entityVersions: (parent: unknown, args: unknown, context: GraphQLContext) =>
      conflictResolver.entityVersions(
        parent,
        args as { entityType: string; entityId: string; limit?: number },
        context
      ),
  },
  Mutation: {
    // Account mutations
    createAccount: (parent: unknown, args: unknown, context: GraphQLContext) =>
      accountResolver.createAccount(
        parent,
        args as { input: { name: string; initBalance?: number } },
        context
      ),
    updateAccount: (parent: unknown, args: unknown, context: GraphQLContext) =>
      accountResolver.updateAccount(
        parent,
        args as { id: string; input: { name?: string; initBalance?: number } },
        context
      ),
    deleteAccount: (parent: unknown, args: unknown, context: GraphQLContext) =>
      accountResolver.deleteAccount(parent, args as { id: string }, context),

    // Transaction mutations
    createTransaction: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      transactionResolver.createTransaction(
        parent,
        args as { input: unknown },
        context
      ),
    updateTransaction: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      transactionResolver.updateTransaction(
        parent,
        args as { id: string; input: unknown },
        context
      ),
    deleteTransaction: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      transactionResolver.deleteTransaction(
        parent,
        args as { id: string },
        context
      ),

    // Category mutations
    createCategory: (parent: unknown, args: unknown, context: GraphQLContext) =>
      categoryResolver.createCategory(
        parent,
        args as { input: { name: string; categoryType: 'Income' | 'Expense' } },
        context
      ),
    updateCategory: (parent: unknown, args: unknown, context: GraphQLContext) =>
      categoryResolver.updateCategory(
        parent,
        args as {
          id: string;
          input: { name?: string; categoryType?: 'Income' | 'Expense' };
        },
        context
      ),
    deleteCategory: (parent: unknown, args: unknown, context: GraphQLContext) =>
      categoryResolver.deleteCategory(parent, args as { id: string }, context),

    // Payee mutations
    createPayee: (parent: unknown, args: unknown, context: GraphQLContext) =>
      payeeResolver.createPayee(
        parent,
        args as { input: { name: string } },
        context
      ),
    updatePayee: (parent: unknown, args: unknown, context: GraphQLContext) =>
      payeeResolver.updatePayee(
        parent,
        args as { id: string; input: { name?: string } },
        context
      ),
    deletePayee: (parent: unknown, args: unknown, context: GraphQLContext) =>
      payeeResolver.deletePayee(parent, args as { id: string }, context),

    // Preferences mutations
    updatePreferences: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      preferencesResolver.updatePreferences(
        parent,
        args as {
          input: {
            currency?: string;
            useThousandSeparator?: boolean;
            colorScheme?: string | null;
            colorSchemeValue?: string | null;
            dateFormat?: string | null;
          };
        },
        context
      ),

    // Recurring transaction mutations
    createRecurringTransaction: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      recurringTransactionResolver.createRecurringTransaction(
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
        context
      ),
    updateRecurringTransaction: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      recurringTransactionResolver.updateRecurringTransaction(
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
        context
      ),
    deleteRecurringTransaction: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      recurringTransactionResolver.deleteRecurringTransaction(
        parent,
        args as { id: string },
        context
      ),

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
          dateFormat?: string;
        },
        context
      ),
    matchImportedTransaction: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      matchImportedTransaction(
        parent,
        args as { importedId: string; transactionId: string },
        context
      ),
    importCSV: (parent: unknown, args: unknown, context: GraphQLContext) =>
      importCSV(
        parent,
        args as {
          file: Promise<{
            filename: string;
            mimetype?: string;
            encoding?: string;
            createReadStream: () => NodeJS.ReadableStream;
          }>;
          entityType: string;
        },
        context
      ),
    saveImportedTransactions: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      saveImportedTransactions(
        parent,
        args as {
          mapping: {
            cardNumber?: string | null;
            cardAccountId?: string | null;
            descriptionMappings: Array<{
              description: string;
              accountId: string;
              categoryId?: string | null;
              payeeId?: string | null;
            }>;
          };
        },
        context
      ),
    deleteUnmappedImportedTransactions: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) => deleteUnmappedImportedTransactions(parent, args, context),

    // Reset data mutation
    resetData: (parent: unknown, args: unknown, context: GraphQLContext) =>
      resetDataResolver.resetData(parent, args, context),

    // Example data mutation
    addExampleData: (parent: unknown, args: unknown, context: GraphQLContext) =>
      exampleDataResolver.addExampleData(parent, args, context),

    // Budget mutations
    createBudget: (parent: unknown, args: unknown, context: GraphQLContext) =>
      budgetResolver.createBudget(parent, args as { input: unknown }, context),
    updateBudget: (parent: unknown, args: unknown, context: GraphQLContext) =>
      budgetResolver.updateBudget(
        parent,
        args as { id: string; input: unknown },
        context
      ),
    deleteBudget: (parent: unknown, args: unknown, context: GraphQLContext) =>
      budgetResolver.deleteBudget(parent, args as { id: string }, context),
    markBudgetNotificationRead: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      budgetResolver.markBudgetNotificationRead(
        parent,
        args as { id: string },
        context
      ),

    // Workspace mutations
    createWorkspace: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      workspaceResolver.createWorkspace(
        parent,
        args as { name: string },
        context
      ),
    updateWorkspace: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      workspaceResolver.updateWorkspace(
        parent,
        args as { id: string; name?: string },
        context
      ),
    deleteWorkspace: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      workspaceResolver.deleteWorkspace(
        parent,
        args as { id: string },
        context
      ),
    inviteUserToWorkspace: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      workspaceResolver.inviteUserToWorkspace(
        parent,
        args as {
          workspaceId: string;
          email: string;
          role?: 'Owner' | 'Admin' | 'Member';
        },
        context
      ),
    acceptWorkspaceInvitation: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      workspaceResolver.acceptWorkspaceInvitation(
        parent,
        args as { token: string },
        context
      ),
    cancelWorkspaceInvitation: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      workspaceResolver.cancelWorkspaceInvitation(
        parent,
        args as { invitationId: string },
        context
      ),
    updateWorkspaceMemberRole: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      workspaceResolver.updateWorkspaceMemberRole(
        parent,
        args as {
          workspaceId: string;
          memberId: string;
          role: 'Owner' | 'Admin' | 'Member';
        },
        context
      ),
    removeWorkspaceMember: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      workspaceResolver.removeWorkspaceMember(
        parent,
        args as { workspaceId: string; memberId: string },
        context
      ),

    // Conflict mutations
    resolveConflict: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      conflictResolver.resolveConflict(
        parent,
        args as {
          conflictId: string;
          chosenVersion: number;
          mergeData?: Record<string, unknown>;
        },
        context
      ),
    dismissConflict: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      conflictResolver.dismissConflict(
        parent,
        args as { conflictId: string },
        context
      ),

    // Batch mutations
    bulkCreateAccounts: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      batchResolver.bulkCreateAccounts(
        parent,
        args as { inputs: unknown[] },
        context
      ),
    bulkUpdateAccounts: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      batchResolver.bulkUpdateAccounts(
        parent,
        args as { inputs: unknown[] },
        context
      ),
    bulkCreateCategories: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      batchResolver.bulkCreateCategories(
        parent,
        args as { inputs: unknown[] },
        context
      ),
    bulkUpdateCategories: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      batchResolver.bulkUpdateCategories(
        parent,
        args as { inputs: unknown[] },
        context
      ),
    bulkCreatePayees: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      batchResolver.bulkCreatePayees(
        parent,
        args as { inputs: unknown[] },
        context
      ),
    bulkUpdatePayees: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      batchResolver.bulkUpdatePayees(
        parent,
        args as { inputs: unknown[] },
        context
      ),
    bulkCreateTransactions: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      batchResolver.bulkCreateTransactions(
        parent,
        args as { inputs: unknown[] },
        context
      ),
    bulkUpdateTransactions: (
      parent: unknown,
      args: unknown,
      context: GraphQLContext
    ) =>
      batchResolver.bulkUpdateTransactions(
        parent,
        args as { inputs: unknown[] },
        context
      ),
  },
  Account: {
    balance: async (
      parent: { id: string },
      _: unknown,
      context: GraphQLContext
    ) => {
      return context.accountBalanceLoader.load(parent.id);
    },
    versions: async (parent: Account, _: unknown, context: GraphQLContext) => {
      return accountResolver.versions(parent, _, context);
    },
    createdBy: async (parent: Account, _: unknown, context: GraphQLContext) => {
      return accountResolver.createdBy(parent, _, context);
    },
    lastEditedBy: async (
      parent: Account,
      _: unknown,
      context: GraphQLContext
    ) => {
      return accountResolver.lastEditedBy(parent, _, context);
    },
  },
  Category: {
    versions: async (parent: Category, _: unknown, context: GraphQLContext) => {
      return categoryResolver.versions(parent, _, context);
    },
    createdBy: async (
      parent: Category,
      _: unknown,
      context: GraphQLContext
    ) => {
      return categoryResolver.createdBy(parent, _, context);
    },
    lastEditedBy: async (
      parent: Category,
      _: unknown,
      context: GraphQLContext
    ) => {
      return categoryResolver.lastEditedBy(parent, _, context);
    },
  },
  Payee: {
    versions: async (parent: Payee, _: unknown, context: GraphQLContext) => {
      return payeeResolver.versions(parent, _, context);
    },
    createdBy: async (parent: Payee, _: unknown, context: GraphQLContext) => {
      return payeeResolver.createdBy(parent, _, context);
    },
    lastEditedBy: async (
      parent: Payee,
      _: unknown,
      context: GraphQLContext
    ) => {
      return payeeResolver.lastEditedBy(parent, _, context);
    },
  },
  Transaction: {
    category: async (
      parent: Transaction,
      _: unknown,
      context: GraphQLContext
    ) => {
      return transactionResolver.fieldResolver.category(parent, _, context);
    },
    payee: async (parent: Transaction, _: unknown, context: GraphQLContext) => {
      return transactionResolver.fieldResolver.payee(parent, _, context);
    },
    account: async (
      parent: Transaction,
      _: unknown,
      context: GraphQLContext
    ) => {
      return transactionResolver.fieldResolver.account(parent, _, context);
    },
    versions: async (
      parent: Transaction,
      _: unknown,
      context: GraphQLContext
    ) => {
      return transactionResolver.versions(parent, _, context);
    },
    createdBy: async (
      parent: Transaction,
      _: unknown,
      context: GraphQLContext
    ) => {
      return transactionResolver.createdBy(parent, _, context);
    },
    lastEditedBy: async (
      parent: Transaction,
      _: unknown,
      context: GraphQLContext
    ) => {
      return transactionResolver.lastEditedBy(parent, _, context);
    },
  },
  RecurringTransaction: {
    category: async (
      parent: { categoryId: string | null },
      _: unknown,
      context: GraphQLContext
    ) => {
      if (!parent.categoryId) return null;
      return context.categoryLoader.load(parent.categoryId);
    },
    payee: async (
      parent: { payeeId: string | null },
      _: unknown,
      context: GraphQLContext
    ) => {
      if (!parent.payeeId) return null;
      return context.payeeLoader.load(parent.payeeId);
    },
    account: async (
      parent: { accountId: string },
      _: unknown,
      context: GraphQLContext
    ) => {
      return context.accountLoader.load(parent.accountId);
    },
  },
  Budget: {
    percentageUsed: (parent: {
      amount: number | string;
      currentSpent: number | string;
    }) => {
      const amount =
        typeof parent.amount === 'string'
          ? parseFloat(parent.amount)
          : parent.amount;
      const spent =
        typeof parent.currentSpent === 'string'
          ? parseFloat(parent.currentSpent)
          : parent.currentSpent;
      if (amount === 0) return 0;
      return (spent / amount) * 100;
    },
    versions: async (parent: Budget, _: unknown, context: GraphQLContext) => {
      return budgetResolver.versions(parent, _, context);
    },
    createdBy: async (parent: Budget, _: unknown, context: GraphQLContext) => {
      return budgetResolver.createdBy(parent, _, context);
    },
    lastEditedBy: async (
      parent: Budget,
      _: unknown,
      context: GraphQLContext
    ) => {
      return budgetResolver.lastEditedBy(parent, _, context);
    },
  },
  Workspace: {
    members: async (
      parent: { id: string },
      _: unknown,
      context: GraphQLContext
    ) => {
      return workspaceResolver.workspaceMembers(
        parent,
        { workspaceId: parent.id },
        context
      );
    },
    invitations: async (
      parent: { id: string },
      _: unknown,
      context: GraphQLContext
    ) => {
      return workspaceResolver.workspaceInvitations(
        parent,
        { workspaceId: parent.id },
        context
      );
    },
  },
  WorkspaceMember: {
    workspace: async (
      parent: { workspaceId: string },
      _: unknown,
      context: GraphQLContext
    ) => {
      return workspaceResolver.workspace(
        parent,
        { id: parent.workspaceId },
        context
      );
    },
    user: async (
      parent: { userId: string },
      _: unknown,
      context: GraphQLContext
    ) => {
      return context.userLoader.load(parent.userId);
    },
  },
  WorkspaceInvitation: {
    workspace: async (
      parent: { workspaceId: string },
      _: unknown,
      context: GraphQLContext
    ) => {
      return workspaceResolver.workspace(
        parent,
        { id: parent.workspaceId },
        context
      );
    },
    inviter: async (
      parent: { invitedBy: string },
      _: unknown,
      context: GraphQLContext
    ) => {
      return context.userLoader.load(parent.invitedBy);
    },
  },
  Subscription: {
    accountUpdated: subscriptionResolver.accountUpdated,
    categoryUpdated: subscriptionResolver.categoryUpdated,
    payeeUpdated: subscriptionResolver.payeeUpdated,
    transactionUpdated: subscriptionResolver.transactionUpdated,
    budgetUpdated: subscriptionResolver.budgetUpdated,
    entityConflictDetected: subscriptionResolver.entityConflictDetected,
  },
};
