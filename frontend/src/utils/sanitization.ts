/**
 * Input Sanitization Utility
 * Frontend-specific sanitization using DOMPurify for browser environment
 * Shared sanitization functions are imported from @my-money/shared
 */

import DOMPurify from 'dompurify';
import { sanitizeFormInput as sharedSanitizeFormInput } from '@my-money/shared';

/**
 * Sanitize a string input to prevent XSS attacks using DOMPurify
 * @param input - String input to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }
  // DOMPurify sanitizes HTML/script tags and dangerous content
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Sanitize an object's string properties recursively using DOMPurify
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeString(value);
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(
        value as Record<string, unknown>
      );
    } else if (Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = value.map((item: unknown) => {
        if (typeof item === 'string') {
          return sanitizeString(item);
        }
        if (
          item !== null &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          !(item instanceof Date)
        ) {
          return sanitizeObject(item as Record<string, unknown>);
        }
        return item;
      });
    }
  }
  return sanitized;
}

/**
 * Sanitize form input values before sending to backend
 * Uses shared sanitization for consistency
 * @param input - Form input object
 * @returns Sanitized input
 */
export function sanitizeFormInput<T extends Record<string, unknown>>(input: T): T {
  return sharedSanitizeFormInput(input);
}
