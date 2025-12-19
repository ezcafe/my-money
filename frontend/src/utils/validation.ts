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

