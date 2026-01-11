/**
 * Prisma Error Handling Utilities
 * Converts Prisma-specific errors to application-friendly error types
 */

import {Prisma} from '@prisma/client';
import {
  ValidationError,
  NotFoundError,
  AppError,
} from './errors';

/**
 * Handle Prisma errors and convert them to application errors
 * @param error - The error to handle
 * @param context - Context information for better error messages
 * @returns Application error or rethrows if not a Prisma error
 */
export function handlePrismaError(
  error: unknown,
  context?: {
    resource?: string;
    operation?: string;
  },
): never {
  const resource = context?.resource ?? 'Resource';
  const operation = context?.operation ?? 'operation';

  // Handle Prisma known request errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // TypeScript narrows the type after instanceof check
    switch (error.code) {
      case 'P2002': {
        // Unique constraint violation

        const target = error.meta?.target as string[] | undefined;
        const field = target?.[0] ?? 'field';
        throw new ValidationError(
          `A ${resource.toLowerCase()} with this ${field} already exists`,
        );
      }

      case 'P2025': {
        // Record not found
        throw new NotFoundError(resource);
      }

      case 'P2003': {
        // Foreign key constraint violation
        throw new ValidationError(
          `Invalid reference: The related ${resource.toLowerCase()} does not exist`,
        );
      }

      case 'P2014': {
        // Required relation violation
        throw new ValidationError(
          `Invalid ${resource.toLowerCase()}: Required relation is missing`,
        );
      }

      case 'P2000': {
        // Input value too long
        throw new ValidationError(
          `Input value is too long for one or more fields`,
        );
      }

      case 'P2001': {
        // Record does not exist (used in where clauses)
        throw new NotFoundError(resource);
      }

      case 'P2011': {
        // Null constraint violation
        throw new ValidationError(

          `Required field is missing: ${error.meta?.target as string}`,
        );
      }

      case 'P2012': {
        // Missing required value
        throw new ValidationError(

          `Missing required value: ${error.meta?.target as string}`,
        );
      }

      case 'P2015': {
        // Related record not found
        throw new NotFoundError(
          `Related ${resource.toLowerCase()} not found`,
        );
      }

      case 'P2016': {
        // Query interpretation error
        throw new AppError(
          `Database query error: ${error.message}`,
          'DATABASE_QUERY_ERROR',
          500,
        );
      }

      case 'P2017': {
        // Records for relation not connected
        throw new ValidationError(

          `Records are not properly connected: ${error.meta?.relation_name as string}`,
        );
      }

      case 'P2018': {
        // Required connected records not found
        throw new NotFoundError(

          `Required connected records not found: ${error.meta?.details as string}`,
        );
      }

      case 'P2019': {
        // Input error
        throw new ValidationError(

          `Invalid input: ${error.meta?.details as string}`,
        );
      }

      case 'P2020': {
        // Value out of range
        throw new ValidationError(

          `Value out of range: ${error.meta?.details as string}`,
        );
      }

      case 'P2021': {
        // Table does not exist
        throw new AppError(

          `Database table not found: ${error.meta?.table as string}`,
          'DATABASE_ERROR',
          500,
        );
      }

      case 'P2022': {
        // Column does not exist
        throw new AppError(

          `Database column not found: ${error.meta?.column as string}`,
          'DATABASE_ERROR',
          500,
        );
      }

      case 'P2023': {
        // Inconsistent column data
        throw new AppError(
          `Database data inconsistency: ${error.message}`,
          'DATABASE_ERROR',
          500,
        );
      }

      case 'P2024': {
        // Connection timeout
        throw new AppError(
          'Database connection timeout. Please try again later.',
          'DATABASE_TIMEOUT',
          503,
        );
      }

      case 'P2026': {
        // Unsupported feature
        throw new AppError(
          `Unsupported database feature: ${error.message}`,
          'DATABASE_ERROR',
          500,
        );
      }

      case 'P2027': {
        // Multiple errors occurred
        throw new ValidationError(
          `Multiple validation errors occurred: ${error.message}`,
        );
      }

      default: {
        // Unknown Prisma error code
        throw new AppError(
          `Database error during ${operation}: ${error.message}`,
          'DATABASE_ERROR',
          500,
        );
      }
    }
  }

  // Handle Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    const firstLine = error.message.split('\n')[0];
    throw new ValidationError(
      `Invalid input data: ${firstLine as string}`,
    );
  }

  // Handle Prisma initialization errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    throw new AppError(
      'Database connection failed. Please try again later.',
      'DATABASE_CONNECTION_ERROR',
      503,
    );
  }

  // Handle Prisma unknown errors
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    throw new AppError(
      `Unexpected database error: ${error.message}`,
      'DATABASE_ERROR',
      500,
    );
  }

  // Handle Prisma RPC errors
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    throw new AppError(
      'Database engine error. Please contact support if this persists.',
      'DATABASE_ENGINE_ERROR',
      500,
    );
  }

  // If it's not a Prisma error, rethrow it
  throw error;
}

/**
 * Wrap a Prisma operation with error handling
 * @param operation - The Prisma operation to execute
 * @param context - Context information for better error messages
 * @returns The result of the operation
 */
export async function withPrismaErrorHandling<T>(
  operation: () => Promise<T>,
  context?: {
    resource?: string;
    operation?: string;
  },
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    handlePrismaError(error, context);
  }
}

