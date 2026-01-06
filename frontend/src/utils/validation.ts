/**
 * Validation utility functions
 * Frontend-specific validation (browser APIs like File)
 * Shared validation functions are imported from @my-money/shared
 */

import {validateDateRange, validateReturnUrl} from '@my-money/shared';

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

// Re-export shared validation functions
export {validateDateRange, validateReturnUrl};


