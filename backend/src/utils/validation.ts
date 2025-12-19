/**
 * Validation utilities
 */

import {z} from 'zod';
import {ValidationError} from './errors';

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
 */
export const schemas = {
  uuid: z.string().uuid(),
  email: z.string().email(),
  decimal: z.number().or(z.string().transform((val) => parseFloat(val))),
  date: z.string().datetime().or(z.date()),
  positiveDecimal: z.number().positive().or(z.string().transform((val) => {
    const num = parseFloat(val);
    if (num <= 0) throw new Error('Must be positive');
    return num;
  })),
};


