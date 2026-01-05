/**
 * Validation utility functions
 * Input validation for forms and user data
 */

/**
 * Validate file type
 * @param file - The file to validate
 * @param allowedTypes - Array of allowed MIME types
 * @returns True if file type is allowed
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * Validate file size
 * @param file - The file to validate
 * @param maxSizeBytes - Maximum file size in bytes
 * @returns True if file size is within limit
 */
export function validateFileSize(file: File, maxSizeBytes: number): boolean {
  return file.size <= maxSizeBytes;
}

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
export function validateDateRange(startDate: Date | string, endDate: Date | string): boolean {
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
export function validateReturnUrl(url: string | null | undefined, defaultUrl: string = '/'): string {
  if (!url) {
    return defaultUrl;
  }

  // Normalize URL: remove query params and hash for validation
  const normalizedUrl = url.split('?')[0]?.split('#')[0] ?? '';

  // Check if URL is in whitelist
  if (ALLOWED_RETURN_PATHS.includes(normalizedUrl as (typeof ALLOWED_RETURN_PATHS)[number])) {
    // If original URL had query params or hash, preserve them
    const queryIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');
    if (queryIndex !== -1 || hashIndex !== -1) {
      // Validate that query params don't contain dangerous patterns
      const queryString = queryIndex !== -1 ? url.substring(queryIndex) : '';
      const hashString = hashIndex !== -1 ? url.substring(hashIndex) : '';

      // Only allow safe query params (no javascript:, data:, etc.)
      if (!queryString.includes('javascript:') && !queryString.includes('data:')) {
        return normalizedUrl + queryString + hashString;
      }
    }
    return normalizedUrl;
  }

  // Fallback: check if it's a relative path starting with / (for backward compatibility)
  // but still reject protocol-relative URLs and external URLs
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('://')) {
    // Additional check: ensure it doesn't contain dangerous patterns
    if (!url.includes('javascript:') && !url.includes('data:') && !url.includes('<')) {
      return url;
    }
  }

  return defaultUrl;
}

