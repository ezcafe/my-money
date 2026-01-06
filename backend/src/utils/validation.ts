/**
 * Validation utilities
 * Comprehensive validation schemas using Zod for type-safe input validation
 */

import {z} from 'zod';
import {ValidationError} from './errors';
import {MAX_USER_INPUT_LENGTH} from './constants';

/**
 * Validate data against a Zod schema
 * @throws {ValidationError} if validation fails
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
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
  decimal: z.number().or(z.string().transform((val) => {
    const num = parseFloat(val);
    if (Number.isNaN(num)) {
      throw new Error('Must be a valid number');
    }
    return num;
  })),
  date: z.string().datetime().or(z.date()),
  positiveDecimal: z.number().positive('Must be a positive number').or(z.string().transform((val) => {
    const num = parseFloat(val);
    if (Number.isNaN(num) || num <= 0) {
      throw new Error('Must be a positive number');
    }
    return num;
  })),
  nonEmptyString: z.string().min(1, 'String cannot be empty'),
  maxLengthString: (maxLength: number) => z.string().max(maxLength, `String must be at most ${maxLength} characters`),
  userInputString: z.string().max(MAX_USER_INPUT_LENGTH, `Input must be at most ${MAX_USER_INPUT_LENGTH} characters`),
  optionalUuid: z.string().uuid('Invalid UUID format').nullable().optional(),
  cronExpression: z.string().regex(/^(\*|([0-9]|[1-5][0-9])|\*\/([0-9]|[1-5][0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|[12][0-9]|3[01])|\*\/([1-9]|[12][0-9]|3[01])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, 'Invalid cron expression'),
};

/**
 * Comprehensive input validation schemas for GraphQL resolvers
 */
export const inputSchemas = {
  createAccount: z.object({
    name: schemas.nonEmptyString.max(255, 'Account name must be at most 255 characters'),
    initBalance: z.number().finite().optional(),
  }),
  updateAccount: z.object({
    name: schemas.nonEmptyString.max(255, 'Account name must be at most 255 characters').optional(),
    initBalance: z.number().finite().optional(),
  }),
  createCategory: z.object({
    name: schemas.nonEmptyString.max(255, 'Category name must be at most 255 characters'),
    type: z.enum(['INCOME', 'EXPENSE'], {errorMap: () => ({message: 'Type must be INCOME or EXPENSE'})}),
  }),
  updateCategory: z.object({
    name: schemas.nonEmptyString.max(255, 'Category name must be at most 255 characters').optional(),
    type: z.enum(['INCOME', 'EXPENSE'], {errorMap: () => ({message: 'Type must be INCOME or EXPENSE'})}).optional(),
  }),
  createPayee: z.object({
    name: schemas.nonEmptyString.max(255, 'Payee name must be at most 255 characters'),
  }),
  updatePayee: z.object({
    name: schemas.nonEmptyString.max(255, 'Payee name must be at most 255 characters').optional(),
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
};


