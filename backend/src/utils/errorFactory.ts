/**
 * Error Factory
 * Provides standardized error creation and error recovery strategies
 * Ensures consistent error response format across the application
 */

import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from './errors';
import { ErrorCode } from './errorCodes';
import { logError } from './logger';

/**
 * Error response format
 */
export interface ErrorResponse {
  message: string;
  code: string;
  statusCode: number;
  requestId?: string;
  timestamp: string;
  context?: Record<string, unknown>;
  recoverable?: boolean;
  retryAfter?: number;
}

/**
 * Error factory class
 * Provides methods to create standardized errors
 */
export class ErrorFactory {
  /**
   * Create a validation error
   * @param message - Error message
   * @param context - Optional context data
   * @returns ValidationError instance
   */
  static validation(
    message: string,
    _context?: Record<string, unknown>
  ): ValidationError {
    return new ValidationError(message);
  }

  /**
   * Create a not found error
   * @param resource - Resource name (e.g., 'Account', 'Transaction')
   * @param context - Optional context data (e.g., {id: '123'})
   * @returns NotFoundError instance
   */
  static notFound(
    resource: string,
    _context?: Record<string, unknown>
  ): NotFoundError {
    // Note: NotFoundError doesn't accept context in constructor, so we create a new AppError-like error
    // For now, we'll just return the error without context since NotFoundError constructor doesn't support it
    return new NotFoundError(resource);
  }

  /**
   * Create an unauthorized error
   * @param message - Error message
   * @param context - Optional context data
   * @returns UnauthorizedError instance
   */
  static unauthorized(
    message: string = 'Unauthorized',
    _context?: Record<string, unknown>
  ): UnauthorizedError {
    // Note: UnauthorizedError doesn't accept context in constructor, so we create a new AppError-like error
    // For now, we'll just return the error without context since UnauthorizedError constructor doesn't support it
    return new UnauthorizedError(message);
  }

  /**
   * Create a forbidden error
   * @param message - Error message
   * @param context - Optional context data
   * @returns ForbiddenError instance
   */
  static forbidden(
    message: string = 'Forbidden',
    _context?: Record<string, unknown>
  ): ForbiddenError {
    // Note: ForbiddenError doesn't accept context in constructor, so we create a new AppError-like error
    // For now, we'll just return the error without context since ForbiddenError constructor doesn't support it
    return new ForbiddenError(message);
  }

  /**
   * Create a conflict error
   * @param message - Error message
   * @param conflictData - Conflict data
   * @returns ConflictError instance
   */
  static conflict(
    message: string,
    conflictData: {
      conflictId: string;
      currentVersion: number;
      expectedVersion: number;
      currentData: Record<string, unknown>;
      incomingData: Record<string, unknown>;
    }
  ): ConflictError {
    return new ConflictError(message, conflictData);
  }

  /**
   * Create an internal server error
   * @param message - Error message
   * @param cause - Optional underlying error
   * @param context - Optional context data
   * @returns AppError instance
   */
  static internal(
    message: string,
    cause?: Error,
    context?: Record<string, unknown>
  ): AppError {
    return new AppError(message, ErrorCode.INTERNAL_SERVER_ERROR, 500, {
      context,
      cause,
    });
  }

  /**
   * Create a standardized error response
   * @param error - Error instance
   * @param requestId - Optional request ID for tracing
   * @returns Standardized error response
   */
  static toResponse(error: Error, requestId?: string): ErrorResponse {
    if (error instanceof AppError) {
      return {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        requestId,
        timestamp: new Date().toISOString(),
        context: error.context,
        recoverable: isRecoverableError(error),
        retryAfter: getRetryAfter(error),
      };
    }

    // Handle unknown errors
    // Safely extract error properties to avoid getters that might access context
    let errorName = 'Error';
    let errorMessage = 'Internal server error';
    try {
      errorName = error.name || 'Error';
      errorMessage = error.message || 'Internal server error';
    } catch {
      // If accessing error properties fails, use defaults
      errorName = 'Error';
      errorMessage = 'Internal server error';
    }

    // Only log if we can safely access error properties
    try {
      logError(
        'Unknown error type',
        {
          event: 'unknown_error',
          errorName,
          errorMessage,
        },
        error
      );
    } catch {
      // If logging fails, continue without logging
      // This prevents recursive errors when error objects have problematic getters
    }

    return {
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : errorMessage,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      statusCode: 500,
      requestId,
      timestamp: new Date().toISOString(),
      recoverable: false,
    };
  }

  /**
   * Determine if an error is recoverable
   * @param error - Error instance
   * @returns True if error is recoverable
   */
  static isRecoverable(error: Error): boolean {
    return isRecoverableError(error);
  }

  /**
   * Get retry after duration in seconds for rate-limited errors
   * @param error - Error instance
   * @returns Retry after duration in seconds, or undefined if not applicable
   */
  static getRetryAfter(error: Error): number | undefined {
    return getRetryAfter(error);
  }
}

/**
 * Determine if an error is recoverable
 * Recoverable errors are those that might succeed on retry
 * @param error - Error instance
 * @returns True if error is recoverable
 */
function isRecoverableError(error: Error): boolean {
  // Network errors, timeouts, and rate limits are recoverable
  if (
    error.message.includes('timeout') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ETIMEDOUT')
  ) {
    return true;
  }

  // Database connection errors are recoverable
  if (error.message.includes('connection') || error.message.includes('P1001')) {
    return true;
  }

  // Validation and authorization errors are not recoverable
  if (
    error instanceof ValidationError ||
    error instanceof UnauthorizedError ||
    error instanceof ForbiddenError
  ) {
    return false;
  }

  // Conflict errors might be recoverable if user updates their data
  if (error instanceof ConflictError) {
    return true;
  }

  // Default: not recoverable
  return false;
}

/**
 * Get retry after duration for rate-limited errors
 * @param error - Error instance
 * @returns Retry after duration in seconds, or undefined if not applicable
 */
function getRetryAfter(error: Error): number | undefined {
  // Check if error indicates rate limiting
  if (
    error.message.includes('rate limit') ||
    error.message.includes('too many requests')
  ) {
    // Default retry after 60 seconds for rate limits
    return 60;
  }

  // Check error context for retryAfter
  if (error instanceof AppError && error.context?.retryAfter) {
    const retryAfter = error.context.retryAfter;
    return typeof retryAfter === 'number' ? retryAfter : undefined;
  }

  return undefined;
}
