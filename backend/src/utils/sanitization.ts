/**
 * Input sanitization utilities
 * Prevents XSS attacks by sanitizing user-generated content
 */

/**
 * Sanitize a string by removing HTML tags and escaping special characters
 * This prevents XSS attacks in user-generated content
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Escape special HTML characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
}

/**
 * Sanitize an object's string properties recursively
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = {...obj};

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeString(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = value.map((item): unknown => {
        if (typeof item === 'string') {
          return sanitizeString(item);
        }
        if (item !== null && typeof item === 'object') {
          return sanitizeObject(item as Record<string, unknown>);
        }
        return item;
      });
    }
  }

  return sanitized;
}

/**
 * Sanitize user input for notes, names, and other text fields
 * This is a lighter version that preserves some formatting
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeUserInput(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove script tags and event handlers
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');

  // Remove HTML tags but preserve line breaks
  sanitized = sanitized.replace(/<br\s*\/?>/gi, '\n');
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Decode HTML entities that were encoded
  sanitized = sanitized
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');

  // Trim and limit length
  sanitized = sanitized.trim();
  const MAX_LENGTH = 10000; // Reasonable limit for user input
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH);
  }

  return sanitized;
}

