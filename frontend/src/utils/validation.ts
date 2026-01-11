/**
 * Validation utility functions
 * Frontend-specific validation (browser APIs like File)
 * Shared validation functions are imported from @my-money/shared
 */

import {validateDateRange as sharedValidateDateRange, validateReturnUrl as sharedValidateReturnUrl} from '@my-money/shared';

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
 * Validate date range
 * @param startDate - Start date
 * @param endDate - End date
 * @returns True if date range is valid (start <= end)
 */
export function validateDateRange(startDate: Date | string, endDate: Date | string): boolean {
  return sharedValidateDateRange(startDate, endDate);
}

/**
 * Validate return URL to prevent open redirect vulnerabilities
 * @param url - URL to validate
 * @param defaultUrl - Default URL to return if validation fails (default: '/')
 * @returns Validated URL or default URL if validation fails
 */
export function validateReturnUrl(url: string | null | undefined, defaultUrl: string = '/'): string {
  return sharedValidateReturnUrl(url, defaultUrl);
}


