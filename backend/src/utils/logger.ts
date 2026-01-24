/**
 * Structured Logging Utility
 * Provides structured logging for better error tracking and alerting
 * Supports log level filtering via LOG_LEVEL environment variable
 */

export interface LogContext {
  [key: string]: string | number | boolean | Date | null | undefined;
}

export interface StructuredLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: LogContext;
  correlationId?: string; // Request ID for tracing
  requestId?: string; // Alias for correlationId
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Log levels in order of severity (lower number = more severe)
 */
const LOG_LEVELS: Record<StructuredLog['level'], number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Get minimum log level from environment variable
 * Defaults to 'info' in production, 'debug' in development
 */
function getMinLogLevel(): StructuredLog['level'] {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && ['error', 'warn', 'info', 'debug'].includes(envLevel)) {
    return envLevel as StructuredLog['level'];
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const MIN_LOG_LEVEL = getMinLogLevel();
const MIN_LOG_LEVEL_VALUE = LOG_LEVELS[MIN_LOG_LEVEL];

/**
 * Check if a log level should be logged based on configured minimum level
 */
function shouldLog(level: StructuredLog['level']): boolean {
  return LOG_LEVELS[level] <= MIN_LOG_LEVEL_VALUE;
}

/**
 * List of sensitive keys that should never be logged
 * These will be redacted from log context
 */
const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'clientSecret',
  'client_secret',
  'authorization',
  'auth',
  'credentials',
  'credential',
  'privateKey',
  'private_key',
  'databaseUrl',
  'database_url',
  'connectionString',
  'connection_string',
];

/**
 * Sanitize context to remove sensitive information
 * Replaces sensitive values with '[REDACTED]'
 * @param context - Log context that may contain sensitive data
 * @returns Sanitized context with sensitive values redacted
 */
function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) {
    return context;
  }

  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    const keyLower = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) =>
      keyLower.includes(sensitiveKey.toLowerCase())
    );

    if (isSensitive && value !== null && value !== undefined) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Global correlation ID storage for request tracking
 * This allows log functions to automatically include correlation IDs
 */
let globalCorrelationId: string | undefined;

/**
 * Set global correlation ID for request tracking
 * @param correlationId - Correlation ID (request ID)
 */
export function setCorrelationId(correlationId: string): void {
  globalCorrelationId = correlationId;
}

/**
 * Get current correlation ID
 * @returns Current correlation ID or undefined
 */
export function getCorrelationId(): string | undefined {
  return globalCorrelationId;
}

/**
 * Clear global correlation ID
 */
export function clearCorrelationId(): void {
  globalCorrelationId = undefined;
}

/**
 * Create a structured log entry
 * @param level - Log level
 * @param message - Log message
 * @param context - Additional context data
 * @param error - Error object if applicable
 * @returns Structured log object
 */
function createLogEntry(
  level: StructuredLog['level'],
  message: string,
  context?: LogContext,
  error?: Error
): StructuredLog {
  const logEntry: StructuredLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  // Add correlation ID from context or global state
  const correlationId =
    context?.correlationId ?? context?.requestId ?? globalCorrelationId;
  if (correlationId) {
    logEntry.correlationId = String(correlationId);
    logEntry.requestId = String(correlationId); // Alias for compatibility
  }

  // Sanitize context to remove sensitive information
  if (context) {
    const sanitizedContext = sanitizeContext(context);
    // Remove correlationId/requestId from context as it's already in root
    if (sanitizedContext) {
      const {
        correlationId: _,
        requestId: __,
        ...restContext
      } = sanitizedContext;
      logEntry.context = restContext;
    }
  }

  if (error) {
    // Safely extract error properties to avoid getters that might access context
    let errorName = 'Error';
    let errorMessage = 'Unknown error';
    let errorStack: string | undefined;

    try {
      errorName = error.name || 'Error';
    } catch {
      // If accessing error.name fails, use default
      errorName = 'Error';
    }

    try {
      errorMessage = error.message || 'Unknown error';
    } catch {
      // If accessing error.message fails, use default
      errorMessage = 'Unknown error';
    }

    try {
      errorStack = error.stack;
    } catch {
      // If accessing error.stack fails, leave undefined
      errorStack = undefined;
    }

    // Sanitize error message if it might contain sensitive data
    const sanitizedMessage = SENSITIVE_KEYS.some((key) =>
      errorMessage.toLowerCase().includes(key.toLowerCase())
    )
      ? '[REDACTED: Error message may contain sensitive data]'
      : errorMessage;

    logEntry.error = {
      name: errorName,
      message: sanitizedMessage,
      stack: errorStack,
    };
  }

  return logEntry;
}

/**
 * Log an info message
 * @param message - Log message
 * @param context - Additional context data
 */
export function logInfo(message: string, context?: LogContext): void {
  if (!shouldLog('info')) {
    return;
  }
  const logEntry = createLogEntry('info', message, context);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(logEntry));
}

/**
 * Log a warning message
 * @param message - Log message
 * @param context - Additional context data
 */
export function logWarn(message: string, context?: LogContext): void {
  if (!shouldLog('warn')) {
    return;
  }
  const logEntry = createLogEntry('warn', message, context);
  console.warn(JSON.stringify(logEntry));
}

/**
 * Log an error message
 * @param message - Log message
 * @param context - Additional context data (should include userId and requestId for tracing)
 * @param error - Error object
 */
export function logError(
  message: string,
  context?: LogContext,
  error?: Error
): void {
  if (!shouldLog('error')) {
    return;
  }
  const logEntry = createLogEntry('error', message, context, error);
  console.error(JSON.stringify(logEntry));
}

/**
 * Log a debug message
 * @param message - Log message
 * @param context - Additional context data
 */
export function logDebug(message: string, context?: LogContext): void {
  if (!shouldLog('debug')) {
    return;
  }
  const logEntry = createLogEntry('debug', message, context);
  // eslint-disable-next-line no-console
  console.debug(JSON.stringify(logEntry));
}
