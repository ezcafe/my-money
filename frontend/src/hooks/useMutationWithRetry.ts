/**
 * Hook for mutations with automatic retry logic
 * Implements exponential backoff for transient failures
 */

import { useMutation, type MutationHookOptions, type MutationTuple } from '@apollo/client/react';
import type { DocumentNode, OperationVariables } from '@apollo/client';

/**
 * Options for useMutationWithRetry hook
 */
export interface UseMutationWithRetryOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> extends MutationHookOptions<TData, TVariables> {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  retryCount?: number;

  /**
   * Initial retry delay in milliseconds (default: 1000)
   * Subsequent retries use exponential backoff
   */
  retryDelay?: number;

  /**
   * Function to determine if an error should be retried
   * @param error - The error that occurred
   * @returns true if the error should be retried
   */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Hook for mutations with automatic retry logic
 * @param mutation - GraphQL mutation document
 * @param options - Mutation options including retry configuration
 * @returns Mutation tuple with retry logic
 */
export function useMutationWithRetry<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  mutation: DocumentNode,
  options: UseMutationWithRetryOptions<TData, TVariables> = {}
): MutationTuple<TData, TVariables> {
  const { retryCount = 3, retryDelay = 1000, shouldRetry, ...mutationOptions } = options;

  /**
   * Default retry predicate
   * Retries on network errors and 5xx server errors
   */
  const defaultShouldRetry = (error: unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Retry on network errors
      if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
        return true;
      }
      // Retry on connection errors
      if (message.includes('connection') || message.includes('refused')) {
        return true;
      }
    }
    // Check for 5xx status codes
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (typeof statusCode === 'number' && statusCode >= 500 && statusCode < 600) {
        return true;
      }
    }
    return false;
  };

  const retryPredicate = shouldRetry ?? defaultShouldRetry;

  const [mutate, result] = useMutation<TData, TVariables>(mutation, {
    ...mutationOptions,
    onError: (error: unknown, ...args: unknown[]): void => {
      void (async (): Promise<void> => {
        // Call original onError if provided
        if (mutationOptions.onError) {
          // Type assertion needed because Apollo Client's onError signature is complex
          (mutationOptions.onError as unknown as (error: unknown, ...args: unknown[]) => void)(
            error,
            ...args
          );
        }

        // Don't retry if error shouldn't be retried
        if (!retryPredicate(error)) {
          return;
        }

        // Attempt retries with exponential backoff
        for (let attempt = 1; attempt <= retryCount; attempt++) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise((resolve) => {
            setTimeout(resolve, delay);
          });

          try {
            // Retry the mutation with the same variables
            // Note: This is a simplified retry - in practice, you'd need to store
            // the variables from the original mutation call
            // For a complete implementation, consider using a mutation queue
            break;
          } catch (retryError: unknown) {
            // If this was the last attempt, the error will be handled by the original onError
            if (attempt === retryCount) {
              throw retryError;
            }
          }
        }
      })();
    },
  });

  /**
   * Wrapped mutate function with retry logic
   */
  const mutateWithRetry = async (
    ...args: Parameters<typeof mutate>
  ): Promise<ReturnType<typeof mutate>> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const result = await mutate(...args);
        return result;
      } catch (error: unknown) {
        lastError = error;

        // Don't retry if error shouldn't be retried
        if (!retryPredicate(error)) {
          throw error;
        }

        // Don't retry on the last attempt
        if (attempt === retryCount) {
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError;
  };

  return [mutateWithRetry as unknown as typeof mutate, result] as MutationTuple<TData, TVariables>;
}
