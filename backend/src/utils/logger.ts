/**
 * Structured Logging Utility
 * Provides structured logging for better error tracking and alerting
 */

export interface LogContext {
  [key: string]: string | number | boolean | Date | null | undefined;
}

export interface StructuredLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
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
  error?: Error,
): StructuredLog {
  const logEntry: StructuredLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context) {
    logEntry.context = context;
  }

  if (error) {
    logEntry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
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
  const logEntry = createLogEntry('warn', message, context);
  console.warn(JSON.stringify(logEntry));
}

/**
 * Log an error message
 * @param message - Log message
 * @param context - Additional context data (should include userId and requestId for tracing)
 * @param error - Error object
 */
export function logError(message: string, context?: LogContext, error?: Error): void {
  const logEntry = createLogEntry('error', message, context, error);
  console.error(JSON.stringify(logEntry));
}

/**
 * Log a debug message (only in development)
 * @param message - Log message
 * @param context - Additional context data
 */
export function logDebug(message: string, context?: LogContext): void {
  if (process.env.NODE_ENV === 'development') {
    const logEntry = createLogEntry('debug', message, context);
    // eslint-disable-next-line no-console
    console.debug(JSON.stringify(logEntry));
  }
}

