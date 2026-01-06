/**
 * Application constants
 * Centralizes magic numbers and strings to improve maintainability
 */

// Pagination constants
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 1000;
export const DEFAULT_RECENT_TRANSACTIONS_LIMIT = 30;

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
export const DEFAULT_CATEGORY_NAME_EXPENSE = 'Default Expense Category';
export const DEFAULT_CATEGORY_NAME_INCOME = 'Default Income Category';
export const DEFAULT_PAYEE_NAME = 'Default Payee';

// Date format constants
export const DEFAULT_DATE_FORMAT = 'DD/MM/YYYY';

// Rate limiting constants
export const GENERAL_RATE_LIMIT_MAX = 100;
export const GENERAL_RATE_LIMIT_WINDOW = '1 minute';

// Request size limits
export const MAX_GRAPHQL_BODY_SIZE = 2 * 1024 * 1024; // 2MB

// ReDoS protection constants
export const MAX_REGEX_PATTERN_LENGTH = 500;
export const MAX_REGEX_INPUT_LENGTH = 10000;

// String length constants
export const MAX_ACCOUNT_NAME_LENGTH = 255;
export const MAX_CATEGORY_NAME_LENGTH = 255;
export const MAX_PAYEE_NAME_LENGTH = 255;
export const MAX_TRANSACTION_NOTE_LENGTH = 1000;
export const MAX_FILENAME_LENGTH = 255;

// Cache and performance constants
export const CACHE_EVICTION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const CACHE_GC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Time constants
export const ONE_MINUTE_MS = 60 * 1000;
export const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

