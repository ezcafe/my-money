/**
 * Input Sanitization Middleware
 * Provides centralized input sanitization for GraphQL resolvers
 */

import type {GraphQLResolveInfo} from 'graphql';
import {sanitizeUserInput, sanitizeObject} from '../utils/sanitization';

/**
 * Sanitize GraphQL input arguments
 * Recursively sanitizes string values in input objects
 * @param args - GraphQL resolver arguments
 * @returns Sanitized arguments
 */
export function sanitizeInput<T>(args: T): T {
  if (typeof args === 'string') {
    return sanitizeUserInput(args) as T;
  }
  if (args && typeof args === 'object' && !Array.isArray(args) && !(args instanceof Date)) {
    return sanitizeObject(args as Record<string, unknown>) as T;
  }
  return args;
}

/**
 * Middleware factory for input sanitization
 * Wraps resolver functions to automatically sanitize inputs
 * @param resolver - Resolver function to wrap
 * @returns Wrapped resolver with input sanitization
 */
export function withInputSanitization<TArgs, TContext, TReturn>(
  resolver: (
    parent: unknown,
    args: TArgs,
    context: TContext,
    info: GraphQLResolveInfo,
  ) => Promise<TReturn> | TReturn,
): (
  parent: unknown,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => Promise<TReturn> | TReturn {
  return async (parent, args, context, info) => {
    const sanitizedArgs = sanitizeInput(args);
    return resolver(parent, sanitizedArgs, context, info);
  };
}

