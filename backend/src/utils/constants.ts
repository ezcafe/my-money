/**
 * Application constants
 * Centralizes magic numbers and strings to improve maintainability
 */

// File upload constants
export const MAX_PDF_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_CSV_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_USER_INPUT_LENGTH = 10000;

// Processing constants
export const TRANSACTION_BATCH_SIZE = 5;
export const BUDGET_BATCH_SIZE = 100;
export const BUDGET_CONCURRENCY_LIMIT = 10;
export const RECURRING_TRANSACTION_CONCURRENCY_LIMIT = 5;

// Cache constants
export const DATALOADER_CACHE_SIZE_LIMIT = 1000;
export const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Default values
export const DEFAULT_ACCOUNT_NAME = 'Cash';

// Request size limits
export const MAX_MULTIPART_FILE_SIZE = 10 * 1024 * 1024; // 10MB

