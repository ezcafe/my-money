/**
 * Validation constants
 * File size limits, allowed file types, and other validation rules
 */

/**
 * Maximum file size for PDF uploads (10MB)
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Allowed file types for PDF uploads
 */
export const ALLOWED_FILE_TYPES = ['application/pdf'] as const;
