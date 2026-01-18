/**
 * Standardized Error Handling Utilities
 * Provides consistent error handling patterns across resolvers and services
 */

import {AppError, NotFoundError, ValidationError} from './errors';
import {logError} from './logger';
import {withPrismaErrorHandling} from './prismaErrors';

/**
 * Context for error handling operations
 */
export interface ErrorContext {
  /** Resource name (e.g., 'Account', 'Transaction') */
  resource?: string;
  /** Operation name (e.g., 'create', 'update', 'delete') */
  operation?: string;
  /** Additional context data */
  [key: string]: unknown;
}

/**
 * Handle an operation with standardized error handling
 * Wraps operations with consistent error handling, logging, and context
 * @param operation - Async operation to execute
 * @param context - Error context for logging and debugging
 * @returns Result of the operation
 * @throws AppError with context and cause chain
 */
export async function handleOperation<T>(
  operation: () => Promise<T>,
  context: ErrorContext = {},
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // If it's already an AppError, add context and rethrow
    if (error instanceof AppError) {
      // Add context if not already present
      if (context && Object.keys(context).length > 0) {
        const errorWithContext = new AppError(
          error.message,
          error.code,
          error.statusCode,
          {
            context: {...error.context, ...context},
            cause: error.cause,
          },
        );
        logError(
          `Operation failed: ${context.operation ?? 'unknown'}`,
          {
            event: 'operation_failed',
            resource: context.resource,
            operation: context.operation,
            errorCode: error.code,
            ...context,
          },
          errorWithContext,
        );
        throw errorWithContext;
      }
      // Log error even if no additional context
      logError(
        `Operation failed: ${context.operation ?? 'unknown'}`,
        {
          event: 'operation_failed',
          resource: context.resource,
          operation: context.operation,
          errorCode: error.code,
          ...context,
        },
        error,
      );
      throw error;
    }

    // For non-AppError exceptions, wrap in AppError with context
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const appError = new AppError(
      errorObj.message,
      'INTERNAL_ERROR',
      500,
      {
        context,
        cause: errorObj,
      },
    );

    logError(
      `Unexpected error in operation: ${context.operation ?? 'unknown'}`,
      {
        event: 'unexpected_error',
        resource: context.resource,
        operation: context.operation,
        ...context,
      },
      appError,
    );

    throw appError;
  }
}

/**
 * Handle Prisma operations with standardized error handling
 * Combines Prisma error handling with standardized context
 * @param operation - Prisma operation to execute
 * @param context - Error context
 * @returns Result of the operation
 */
export async function handlePrismaOperation<T>(
  operation: () => Promise<T>,
  context: ErrorContext = {},
): Promise<T> {
  return handleOperation(
    () => withPrismaErrorHandling(operation, context),
    context,
  );
}

/**
 * Handle operations that may return null with NotFoundError
 * @param operation - Operation that may return null
 * @param resourceName - Name of the resource (for error message)
 * @param context - Additional error context
 * @returns Non-null result
 * @throws NotFoundError if result is null
 */
export async function handleOperationOrNotFound<T>(
  operation: () => Promise<T | null>,
  resourceName: string,
  context: ErrorContext = {},
): Promise<T> {
  const result = await handleOperation(operation, {
    ...context,
    resource: resourceName,
  });

  if (result === null) {
    throw new NotFoundError(resourceName);
  }

  return result;
}

/**
 * Handle validation with standardized error handling
 * @param validateFn - Validation function that may throw ValidationError
 * @param context - Error context
 * @returns Validated result
 * @throws ValidationError with context
 */
export function handleValidation<T>(
  validateFn: () => T,
  context: ErrorContext = {},
): T {
  try {
    return validateFn();
  } catch (error) {
    if (error instanceof ValidationError) {
      // Add context to validation error
      const errorWithContext = new ValidationError(
        error.message,
      );
      (errorWithContext as {context?: ErrorContext}).context = {
        ...(error as {context?: ErrorContext}).context,
        ...context,
      };
      throw errorWithContext;
    }
    throw error;
  }
}
