/**
 * Form Validation Utility
 * Provides reusable validation patterns and schemas
 */

/**
 * Validation rule function type
 */
type ValidationRule<T = unknown> = (value: T) => string | null;

/**
 * Validation schema for a field
 */
interface FieldValidationSchema<T = unknown> {
  /** Field key */
  key: string;
  /** Validation rules */
  rules: ValidationRule<T>[];
  /** Whether field is required */
  required?: boolean;
}

/**
 * Form validation schema
 */
interface FormValidationSchema {
  /** Field validations */
  fields: FieldValidationSchema[];
  /** Optional form-level validation */
  form?: (values: Record<string, unknown>) => string | null;
}

/**
 * Validation result
 */
interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Field errors */
  fieldErrors: Record<string, string>;
  /** Form-level error */
  formError: string | null;
}

/**
 * Common validation rules
 */
export const validationRules = {
  /**
   * Required field validation
   */
  required: <T>(value: T): string | null => {
    if (value === null || value === undefined || value === '') {
      return 'This field is required';
    }
    return null;
  },

  /**
   * String length validation
   */
  minLength: (min: number) => (value: string): string | null => {
    if (typeof value === 'string' && value.length < min) {
      return `Must be at least ${min} characters`;
    }
    return null;
  },

  /**
   * String max length validation
   */
  maxLength: (max: number) => (value: string): string | null => {
    if (typeof value === 'string' && value.length > max) {
      return `Must be at most ${max} characters`;
    }
    return null;
  },

  /**
   * Number validation
   */
  number: (value: unknown): string | null => {
    if (value === null || value === undefined || value === '') {
      return null; // Let required rule handle empty values
    }
    const valueStr = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
    const num = Number.parseFloat(valueStr);
    if (Number.isNaN(num)) {
      return 'Must be a valid number';
    }
    return null;
  },

  /**
   * Positive number validation
   */
  positive: (value: unknown): string | null => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const valueStr = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
    const num = Number.parseFloat(valueStr);
    if (Number.isNaN(num) || num <= 0) {
      return 'Must be a positive number';
    }
    return null;
  },

  /**
   * Non-zero number validation (for transaction values)
   */
  nonZero: (value: unknown): string | null => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const valueStr = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
    const num = Number.parseFloat(valueStr);
    if (Number.isNaN(num) || num === 0) {
      return 'Value cannot be zero';
    }
    return null;
  },

  /**
   * Decimal precision validation
   */
  maxDecimals: (maxDecimals: number) => (value: unknown): string | null => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const valueStr = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
    const decimalParts = valueStr.split('.');
    if (decimalParts.length > 1 && decimalParts[1] && decimalParts[1].length > maxDecimals) {
      return `Maximum ${maxDecimals} decimal places allowed`;
    }
    return null;
  },

  /**
   * Email validation
   */
  email: (value: string): string | null => {
    if (!value) {
      return null; // Let required rule handle empty values
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Must be a valid email address';
    }
    return null;
  },

  /**
   * URL validation
   */
  url: (value: string): string | null => {
    if (!value) {
      return null;
    }
    try {
      new URL(value);
      return null;
    } catch {
      return 'Must be a valid URL';
    }
  },
};

/**
 * Validate a form against a schema
 * @param values - Form values
 * @param schema - Validation schema
 * @returns Validation result
 */
export function validateForm(values: Record<string, unknown>, schema: FormValidationSchema): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  let formError: string | null = null;

  // Validate each field
  for (const field of schema.fields) {
    const value = values[field.key];

    // Check required
    if (field.required) {
      const requiredError = validationRules.required(value);
      if (requiredError) {
        fieldErrors[field.key] = requiredError;
        continue; // Skip other rules if required fails
      }
    }

    // Run validation rules
    for (const rule of field.rules) {
      const error = rule(value);
      if (error) {
        fieldErrors[field.key] = error;
        break; // Stop at first error
      }
    }
  }

  // Validate form-level rules
  if (schema.form && Object.keys(fieldErrors).length === 0) {
    formError = schema.form(values);
  }

  return {
    isValid: Object.keys(fieldErrors).length === 0 && formError === null,
    fieldErrors,
    formError,
  };
}

/**
 * Create a validation schema for common entity forms
 * @param fields - Field configurations
 * @returns Validation schema
 */
export function createEntityValidationSchema(fields: Array<{key: string; required?: boolean; type?: 'string' | 'number'}>): FormValidationSchema {
  return {
    fields: fields.map((field) => ({
      key: field.key,
      required: field.required ?? false,
      rules: [
        ...(field.required ? [validationRules.required as (value: unknown) => string | null] : []),
        ...(field.type === 'number' ? [validationRules.number as (value: unknown) => string | null] : []),
        ...(field.type === 'string' ? [validationRules.minLength(1) as (value: unknown) => string | null] : []),
      ],
    })),
  };
}

