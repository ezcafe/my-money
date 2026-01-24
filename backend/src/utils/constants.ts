/**
 * Application constants
 * Centralizes magic numbers and strings to improve maintainability
 * Organized by domain for easy maintenance
 */

/**
 * Rate Limiting Constants
 * Defines rate limits for different endpoint types
 * Higher limits in development to avoid rate limiting during development
 */
const isDevelopment = process.env.NODE_ENV !== 'production';

export const RATE_LIMITS = {
  /** General IP-based rate limit (requests per minute) */
  GENERAL_IP: isDevelopment ? 1000 : 100,
  /** Authenticated user rate limit for GraphQL queries (requests per minute) */
  USER_QUERIES: isDevelopment ? 2000 : 200,
  /** GraphQL mutations rate limit (requests per minute) */
  MUTATIONS: isDevelopment ? 500 : 50,
  /** File upload rate limit (requests per minute) */
  UPLOADS: isDevelopment ? 100 : 10,
  /** Authentication endpoint rate limit (requests per minute) */
  AUTH: isDevelopment ? 200 : 5,
  /** Rate limit window in milliseconds */
  WINDOW_MS: 60 * 1000, // 1 minute
} as const;

/**
 * Cache TTL Constants (Time To Live in milliseconds)
 * Defines cache expiration times for different data types
 */
export const CACHE_TTL = {
  /** Default query cache TTL */
  DEFAULT_QUERY: 5 * 60 * 1000, // 5 minutes
  /** Account balance cache TTL */
  ACCOUNT_BALANCE: 60 * 1000, // 1 minute
  /** Transaction query cache TTL */
  TRANSACTION_QUERY: 30 * 1000, // 30 seconds
  /** Report aggregation cache TTL */
  REPORT_AGGREGATION: 2 * 60 * 1000, // 2 minutes
  /** Reference data cache TTL (accounts, categories, payees) */
  REFERENCE_DATA: 15 * 60 * 1000, // 15 minutes
  /** User cache TTL */
  USER: 5 * 60 * 1000, // 5 minutes
  /** Token cache TTL */
  TOKEN: 5 * 60 * 1000, // 5 minutes
  /** Accounts query cache TTL */
  ACCOUNTS_QUERY: 10 * 60 * 1000, // 10 minutes
  /** Categories query cache TTL */
  CATEGORIES_QUERY: 10 * 60 * 1000, // 10 minutes
  /** Payees query cache TTL */
  PAYEES_QUERY: 10 * 60 * 1000, // 10 minutes
  /** Preferences query cache TTL */
  PREFERENCES_QUERY: 10 * 60 * 1000, // 10 minutes
  /** Report transactions query cache TTL */
  REPORT_TRANSACTIONS_QUERY: 5 * 60 * 1000, // 5 minutes
} as const;

/**
 * Validation Constants
 * Defines validation rules and limits
 */
export const VALIDATION = {
  /** Maximum user input string length */
  MAX_USER_INPUT_LENGTH: 10000,
  /** Maximum array size for input validation */
  MAX_ARRAY_SIZE: 100,
  /** Maximum string length for input validation */
  MAX_STRING_LENGTH: 10000,
} as const;

/**
 * File Upload Constants
 * Defines file size limits and allowed types
 */
export const FILE_UPLOAD = {
  /** Maximum PDF file size in bytes */
  MAX_PDF_SIZE: 10 * 1024 * 1024, // 10MB
  /** Maximum CSV file size in bytes */
  MAX_CSV_SIZE: 50 * 1024 * 1024, // 50MB
  /** Maximum multipart file size in bytes */
  MAX_MULTIPART_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

/**
 * Processing Constants
 * Defines batch sizes and concurrency limits
 */
export const PROCESSING = {
  /** Transaction batch size for processing */
  TRANSACTION_BATCH_SIZE: 5,
  /** Budget batch size for processing */
  BUDGET_BATCH_SIZE: 100,
  /** Budget concurrency limit */
  BUDGET_CONCURRENCY_LIMIT: 10,
  /** Recurring transaction concurrency limit */
  RECURRING_TRANSACTION_CONCURRENCY_LIMIT: 5,
} as const;

/**
 * Cache Configuration Constants
 */
export const CACHE = {
  /** DataLoader cache size limit */
  DATALOADER_SIZE_LIMIT: 1000,
} as const;

/**
 * Default Values
 */
export const DEFAULTS = {
  /** Default account name */
  ACCOUNT_NAME: 'Cash',
  /** Credit Card account name */
  CREDIT_CARD_ACCOUNT_NAME: 'Credit Card',
  /** Bank account name */
  BANK_ACCOUNT_NAME: 'Bank',
} as const;

// Legacy exports for backward compatibility
/** @deprecated Use RATE_LIMITS.GENERAL_IP instead */
export const MAX_PDF_FILE_SIZE = FILE_UPLOAD.MAX_PDF_SIZE;
/** @deprecated Use FILE_UPLOAD.MAX_CSV_SIZE instead */
export const MAX_CSV_FILE_SIZE = FILE_UPLOAD.MAX_CSV_SIZE;
/** @deprecated Use VALIDATION.MAX_USER_INPUT_LENGTH instead */
export const MAX_USER_INPUT_LENGTH = VALIDATION.MAX_USER_INPUT_LENGTH;
/** @deprecated Use PROCESSING.TRANSACTION_BATCH_SIZE instead */
export const TRANSACTION_BATCH_SIZE = PROCESSING.TRANSACTION_BATCH_SIZE;
/** @deprecated Use PROCESSING.BUDGET_BATCH_SIZE instead */
export const BUDGET_BATCH_SIZE = PROCESSING.BUDGET_BATCH_SIZE;
/** @deprecated Use PROCESSING.BUDGET_CONCURRENCY_LIMIT instead */
export const BUDGET_CONCURRENCY_LIMIT = PROCESSING.BUDGET_CONCURRENCY_LIMIT;
/** @deprecated Use PROCESSING.RECURRING_TRANSACTION_CONCURRENCY_LIMIT instead */
export const RECURRING_TRANSACTION_CONCURRENCY_LIMIT =
  PROCESSING.RECURRING_TRANSACTION_CONCURRENCY_LIMIT;
/** @deprecated Use CACHE.DATALOADER_SIZE_LIMIT instead */
export const DATALOADER_CACHE_SIZE_LIMIT = CACHE.DATALOADER_SIZE_LIMIT;
/** @deprecated Use CACHE_TTL.TOKEN instead */
export const TOKEN_CACHE_TTL_MS = CACHE_TTL.TOKEN;
/** @deprecated Use DEFAULTS.ACCOUNT_NAME instead */
export const DEFAULT_ACCOUNT_NAME = DEFAULTS.ACCOUNT_NAME;
/** @deprecated Use DEFAULTS.CREDIT_CARD_ACCOUNT_NAME instead */
export const DEFAULT_CREDIT_CARD_ACCOUNT_NAME =
  DEFAULTS.CREDIT_CARD_ACCOUNT_NAME;
/** @deprecated Use DEFAULTS.BANK_ACCOUNT_NAME instead */
export const DEFAULT_BANK_ACCOUNT_NAME = DEFAULTS.BANK_ACCOUNT_NAME;
/** @deprecated Use FILE_UPLOAD.MAX_MULTIPART_SIZE instead */
export const MAX_MULTIPART_FILE_SIZE = FILE_UPLOAD.MAX_MULTIPART_SIZE;
