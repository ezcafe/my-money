/**
 * Custom error classes for the application
 */

import { ErrorCode } from './errorCodes';

export class AppError extends Error {
  /**
   * Additional context for debugging
   * Contains relevant data about the error (e.g., userId, resourceId, etc.)
   */
  public readonly context?: Record<string, unknown>;

  /**
   * The underlying error that caused this error (error chaining)
   */
  public readonly cause?: Error;

  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.context = options?.context;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, ErrorCode.VALIDATION_ERROR, 400);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, ErrorCode.NOT_FOUND, 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, ErrorCode.UNAUTHORIZED, 401);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, ErrorCode.FORBIDDEN, 403);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string,
    public readonly conflictData?: {
      conflictId: string;
      currentVersion: number;
      expectedVersion: number;
      currentData: Record<string, unknown>;
      incomingData: Record<string, unknown>;
    }
  ) {
    super(message, ErrorCode.CONFLICT, 409);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}
