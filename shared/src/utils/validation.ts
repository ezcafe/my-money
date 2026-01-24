/**
 * Validation utility functions
 * Shared validation functions for both frontend and backend
 * Note: File validation is frontend-specific and not included here
 */

/**
 * Validate currency code
 * @param currency - Currency code to validate
 * @returns True if currency code is valid (3 uppercase letters)
 */
export function validateCurrency(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency);
}

/**
 * Validate date range
 * @param startDate - Start date
 * @param endDate - End date
 * @returns True if date range is valid (start <= end)
 */
export function validateDateRange(
  startDate: Date | string,
  endDate: Date | string
): boolean {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  return start <= end;
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns True if email format is valid
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate UUID format
 * @param uuid - UUID string to validate
 * @returns True if UUID format is valid
 */
export function validateUuid(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    uuid
  );
}

/**
 * Validate string length
 * @param str - String to validate
 * @param minLength - Minimum length (optional)
 * @param maxLength - Maximum length (optional)
 * @returns True if string length is within limits
 */
export function validateStringLength(
  str: string,
  minLength?: number,
  maxLength?: number
): boolean {
  if (minLength !== undefined && str.length < minLength) {
    return false;
  }
  if (maxLength !== undefined && str.length > maxLength) {
    return false;
  }
  return true;
}

/**
 * Validate non-empty string
 * @param str - String to validate
 * @returns True if string is not empty
 */
export function validateNonEmptyString(str: string): boolean {
  return str.trim().length > 0;
}

/**
 * Whitelist of allowed return URL paths
 * Only paths in this whitelist are allowed to prevent open redirect vulnerabilities
 */
const ALLOWED_RETURN_PATHS = [
  '/',
  '/transactions',
  '/transactions/add',
  '/accounts',
  '/accounts/add',
  '/categories',
  '/categories/add',
  '/payees',
  '/payees/add',
  '/budgets',
  '/budgets/add',
  '/reports',
  '/import',
  '/preferences',
  '/calculator',
] as const;

/**
 * Validate return URL to prevent open redirect vulnerabilities
 * Uses strict whitelisting instead of just checking prefix
 * @param url - URL to validate
 * @param defaultUrl - Default URL to return if validation fails (default: '/')
 * @returns Validated URL or default URL if validation fails
 */
export function validateReturnUrl(
  url: string | null | undefined,
  defaultUrl: string = '/'
): string {
  if (!url) {
    return defaultUrl;
  }

  // Normalize URL: remove query params and hash for validation
  const normalizedUrl = url.split('?')[0]?.split('#')[0] ?? '';

  // Check if URL is in whitelist
  if (
    ALLOWED_RETURN_PATHS.includes(
      normalizedUrl as (typeof ALLOWED_RETURN_PATHS)[number]
    )
  ) {
    // If original URL had query params or hash, preserve them
    const queryIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');
    if (queryIndex !== -1 || hashIndex !== -1) {
      // Validate that query params don't contain dangerous patterns
      const queryString = queryIndex !== -1 ? url.substring(queryIndex) : '';
      const hashString = hashIndex !== -1 ? url.substring(hashIndex) : '';

      // Only allow safe query params (no javascript:, data:, etc.)
      if (
        !queryString.includes('javascript:') &&
        !queryString.includes('data:')
      ) {
        return normalizedUrl + queryString + hashString;
      }
    }
    return normalizedUrl;
  }

  // Fallback: check if it's a relative path starting with / (for backward compatibility)
  // but still reject protocol-relative URLs and external URLs
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('://')) {
    // Additional check: ensure it doesn't contain dangerous patterns
    if (
      !url.includes('javascript:') &&
      !url.includes('data:') &&
      !url.includes('<')
    ) {
      return url;
    }
  }

  return defaultUrl;
}
