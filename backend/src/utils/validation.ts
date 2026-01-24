/**
 * Validation utilities
 * Comprehensive validation schemas using Zod for type-safe input validation
 */

import { z } from 'zod';
import { ValidationError } from './errors';
import { MAX_USER_INPUT_LENGTH } from './constants';

/**
 * Validate data against a Zod schema
 * @throws {ValidationError} if validation fails
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new ValidationError(errors);
  }
  return result.data;
}

/**
 * Common validation schemas
 * Reusable Zod schemas for consistent validation across the application
 */
export const schemas = {
  uuid: z.string().uuid('Invalid UUID format'),
  email: z.string().email('Invalid email address'),
  decimal: z.number().or(
    z.string().transform((val) => {
      const num = parseFloat(val);
      if (Number.isNaN(num)) {
        throw new Error('Must be a valid number');
      }
      return num;
    })
  ),
  date: z.string().datetime().or(z.date()),
  positiveDecimal: z
    .number()
    .positive('Must be a positive number')
    .or(
      z.string().transform((val) => {
        const num = parseFloat(val);
        if (Number.isNaN(num) || num <= 0) {
          throw new Error('Must be a positive number');
        }
        return num;
      })
    ),
  nonEmptyString: z.string().min(1, 'String cannot be empty'),
  maxLengthString: (maxLength: number): z.ZodString =>
    z.string().max(maxLength, `String must be at most ${maxLength} characters`),
  userInputString: z
    .string()
    .max(
      MAX_USER_INPUT_LENGTH,
      `Input must be at most ${MAX_USER_INPUT_LENGTH} characters`
    ),
  optionalUuid: z.string().uuid('Invalid UUID format').nullable().optional(),
  cronExpression: z
    .string()
    .regex(
      /^(\*|([0-9]|[1-5][0-9])|\*\/([0-9]|[1-5][0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|[12][0-9]|3[01])|\*\/([1-9]|[12][0-9]|3[01])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
      'Invalid cron expression'
    ),
};

/**
 * Comprehensive input validation schemas for GraphQL resolvers
 */
export const inputSchemas = {
  createAccount: z.object({
    name: schemas.nonEmptyString.max(
      255,
      'Account name must be at most 255 characters'
    ),
    initBalance: z.number().finite().optional(),
    accountType: z
      .enum(['Cash', 'CreditCard', 'Bank', 'Saving', 'Loans'], {
        errorMap: () => ({
          message:
            'AccountType must be Cash, CreditCard, Bank, Saving, or Loans',
        }),
      })
      .optional(),
  }),
  updateAccount: z.object({
    name: schemas.nonEmptyString
      .max(255, 'Account name must be at most 255 characters')
      .optional(),
    initBalance: z.number().finite().optional(),
    accountType: z
      .enum(['Cash', 'CreditCard', 'Bank', 'Saving', 'Loans'], {
        errorMap: () => ({
          message:
            'AccountType must be Cash, CreditCard, Bank, Saving, or Loans',
        }),
      })
      .optional(),
  }),
  createCategory: z.object({
    name: schemas.nonEmptyString.max(
      255,
      'Category name must be at most 255 characters'
    ),
    categoryType: z.enum(['Income', 'Expense'], {
      errorMap: () => ({ message: 'Category type must be Income or Expense' }),
    }),
  }),
  updateCategory: z.object({
    name: schemas.nonEmptyString
      .max(255, 'Category name must be at most 255 characters')
      .optional(),
    categoryType: z
      .enum(['Income', 'Expense'], {
        errorMap: () => ({
          message: 'Category type must be Income or Expense',
        }),
      })
      .optional(),
  }),
  createPayee: z.object({
    name: schemas.nonEmptyString.max(
      255,
      'Payee name must be at most 255 characters'
    ),
  }),
  updatePayee: z.object({
    name: schemas.nonEmptyString
      .max(255, 'Payee name must be at most 255 characters')
      .optional(),
  }),
  createTransaction: z.object({
    value: z.number().finite('Value must be a finite number'),
    date: z.date().optional(),
    accountId: schemas.uuid,
    categoryId: schemas.optionalUuid,
    payeeId: schemas.optionalUuid,
    note: schemas.userInputString.optional(),
  }),
  updateTransaction: z.object({
    value: z.number().finite('Value must be a finite number').optional(),
    date: z.date().optional(),
    accountId: schemas.uuid.optional(),
    categoryId: schemas.optionalUuid,
    payeeId: schemas.optionalUuid,
    note: schemas.userInputString.optional(),
  }),
  createRecurringTransaction: z.object({
    cronExpression: schemas.cronExpression,
    value: z.number().finite('Value must be a finite number'),
    accountId: schemas.uuid,
    categoryId: schemas.optionalUuid,
    payeeId: schemas.optionalUuid,
    note: schemas.userInputString.optional(),
  }),
  updateRecurringTransaction: z.object({
    cronExpression: schemas.cronExpression.optional(),
    value: z.number().finite('Value must be a finite number').optional(),
    accountId: schemas.uuid.optional(),
    categoryId: schemas.optionalUuid,
    payeeId: schemas.optionalUuid,
    note: schemas.userInputString.optional(),
  }),
  updatePreferences: z.object({
    currency: z
      .string()
      .max(10, 'Currency code must be at most 10 characters')
      .optional(),
    useThousandSeparator: z.boolean().optional(),
    colorScheme: z
      .string()
      .max(50, 'Color scheme must be at most 50 characters')
      .optional(),
    colorSchemeValue: z
      .string()
      .max(50, 'Color scheme value must be at most 50 characters')
      .optional(),
    dateFormat: z
      .string()
      .max(50, 'Date format must be at most 50 characters')
      .optional(),
  }),
  createBudget: z
    .object({
      amount: z.number().positive('Amount must be positive'),
      accountId: schemas.optionalUuid,
      categoryId: schemas.optionalUuid,
      payeeId: schemas.optionalUuid,
    })
    .refine(
      (data) => {
        // Exactly one of accountId, categoryId, or payeeId must be set
        const count = [data.accountId, data.categoryId, data.payeeId].filter(
          (id) => id !== null && id !== undefined
        ).length;
        return count === 1;
      },
      {
        message: 'Exactly one of accountId, categoryId, or payeeId must be set',
      }
    ),
  updateBudget: z.object({
    amount: z.number().positive('Amount must be positive').optional(),
    expectedVersion: z
      .number()
      .int('Expected version must be an integer')
      .optional(),
  }),
  createWorkspace: z.object({
    name: schemas.nonEmptyString.max(
      255,
      'Workspace name must be at most 255 characters'
    ),
  }),
  updateWorkspace: z.object({
    name: schemas.nonEmptyString
      .max(255, 'Workspace name must be at most 255 characters')
      .optional(),
  }),
  inviteUserToWorkspace: z.object({
    workspaceId: schemas.uuid,
    email: schemas.email,
    role: z
      .enum(['Owner', 'Admin', 'Member'], {
        errorMap: () => ({ message: 'Role must be Owner, Admin, or Member' }),
      })
      .optional(),
  }),
  acceptWorkspaceInvitation: z.object({
    token: schemas.nonEmptyString.max(
      255,
      'Token must be at most 255 characters'
    ),
  }),
  cancelWorkspaceInvitation: z.object({
    invitationId: schemas.uuid,
  }),
  updateWorkspaceMemberRole: z.object({
    workspaceId: schemas.uuid,
    memberId: schemas.uuid,
    role: z.enum(['Owner', 'Admin', 'Member'], {
      errorMap: () => ({ message: 'Role must be Owner, Admin, or Member' }),
    }),
  }),
  removeWorkspaceMember: z.object({
    workspaceId: schemas.uuid,
    memberId: schemas.uuid,
  }),
  resolveConflict: z.object({
    conflictId: schemas.uuid,
    chosenVersion: z
      .number()
      .int('Chosen version must be an integer')
      .positive('Chosen version must be positive'),
    mergeData: z.record(z.unknown()).optional(),
  }),
  dismissConflict: z.object({
    conflictId: schemas.uuid,
  }),
  matchImportedTransaction: z.object({
    importedId: schemas.uuid,
    transactionId: schemas.uuid,
  }),
  saveImportedTransactions: z.object({
    mapping: z.object({
      cardNumber: z
        .string()
        .max(50, 'Card number must be at most 50 characters')
        .optional(),
      cardAccountId: schemas.optionalUuid,
      descriptionMappings: z
        .array(
          z.object({
            description: schemas.nonEmptyString.max(
              500,
              'Description must be at most 500 characters'
            ),
            accountId: schemas.uuid,
            categoryId: schemas.optionalUuid,
            payeeId: schemas.optionalUuid,
          })
        )
        .min(1, 'At least one description mapping is required'),
    }),
  }),
  markBudgetNotificationRead: z.object({
    id: schemas.uuid,
  }),
};

/**
 * Type inference from Zod schemas
 * Provides TypeScript types that match the validation schemas
 */
export type CreateAccountInput = z.infer<typeof inputSchemas.createAccount>;
export type UpdateAccountInput = z.infer<typeof inputSchemas.updateAccount>;
export type CreateCategoryInput = z.infer<typeof inputSchemas.createCategory>;
export type UpdateCategoryInput = z.infer<typeof inputSchemas.updateCategory>;
export type CreatePayeeInput = z.infer<typeof inputSchemas.createPayee>;
export type UpdatePayeeInput = z.infer<typeof inputSchemas.updatePayee>;
export type CreateTransactionInput = z.infer<
  typeof inputSchemas.createTransaction
>;
export type UpdateTransactionInput = z.infer<
  typeof inputSchemas.updateTransaction
>;
export type CreateRecurringTransactionInput = z.infer<
  typeof inputSchemas.createRecurringTransaction
>;
export type UpdateRecurringTransactionInput = z.infer<
  typeof inputSchemas.updateRecurringTransaction
>;
export type UpdatePreferencesInput = z.infer<
  typeof inputSchemas.updatePreferences
>;
export type CreateBudgetInput = z.infer<typeof inputSchemas.createBudget>;
export type UpdateBudgetInput = z.infer<typeof inputSchemas.updateBudget>;
export type CreateWorkspaceInput = z.infer<typeof inputSchemas.createWorkspace>;
export type UpdateWorkspaceInput = z.infer<typeof inputSchemas.updateWorkspace>;
export type InviteUserToWorkspaceInput = z.infer<
  typeof inputSchemas.inviteUserToWorkspace
>;
export type AcceptWorkspaceInvitationInput = z.infer<
  typeof inputSchemas.acceptWorkspaceInvitation
>;
export type CancelWorkspaceInvitationInput = z.infer<
  typeof inputSchemas.cancelWorkspaceInvitation
>;
export type UpdateWorkspaceMemberRoleInput = z.infer<
  typeof inputSchemas.updateWorkspaceMemberRole
>;
export type RemoveWorkspaceMemberInput = z.infer<
  typeof inputSchemas.removeWorkspaceMember
>;
export type ResolveConflictInput = z.infer<typeof inputSchemas.resolveConflict>;
export type DismissConflictInput = z.infer<typeof inputSchemas.dismissConflict>;
export type MatchImportedTransactionInput = z.infer<
  typeof inputSchemas.matchImportedTransaction
>;
export type SaveImportedTransactionsInput = z.infer<
  typeof inputSchemas.saveImportedTransactions
>;
export type MarkBudgetNotificationReadInput = z.infer<
  typeof inputSchemas.markBudgetNotificationRead
>;
