/**
 * Type Guard Utilities
 * Provides type-safe runtime type checking for better type narrowing
 */

/**
 * Type guard to check if a value is a non-null string
 * @param value - Value to check
 * @returns True if value is a non-null string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is a non-empty string
 * @param value - Value to check
 * @returns True if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a number
 * @param value - Value to check
 * @returns True if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Type guard to check if a value is a positive number
 * @param value - Value to check
 * @returns True if value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

/**
 * Type guard to check if a value is a valid UUID
 * @param value - Value to check
 * @returns True if value is a valid UUID
 */
export function isUuid(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Type guard to check if a value is a valid email
 * @param value - Value to check
 * @returns True if value is a valid email
 */
export function isEmail(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Type guard to check if a value is a Date object
 * @param value - Value to check
 * @returns True if value is a Date object
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Type guard to check if a value is an object (not null, not array)
 * @param value - Value to check
 * @returns True if value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is an array
 * @param value - Value to check
 * @returns True if value is an array
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Type guard to check if a value is defined (not null or undefined)
 * @param value - Value to check
 * @returns True if value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if a value is a valid integer
 * @param value - Value to check
 * @returns True if value is a valid integer
 */
export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}
