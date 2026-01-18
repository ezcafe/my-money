/**
 * Async Data Hook using React.use()
 * Demonstrates React 19's use() hook for Promise-based data fetching
 * Use this for Promise-based data fetching instead of useEffect + useState
 */

import {use} from 'react';

/**
 * Hook to unwrap a Promise using React.use()
 * Automatically handles loading and error states
 * @param promise - Promise to unwrap
 * @returns The resolved value from the promise
 * @throws The rejected error if the promise rejects
 */
export function useAsyncData<T>(promise: Promise<T>): T {
  return use(promise);
}

/**
 * Hook to unwrap a Promise with error handling
 * Returns data, loading, and error states
 * @param promise - Promise to unwrap (can be null/undefined to skip)
 * @returns Object with data, loading, and error
 */
export function useAsyncDataSafe<T>(
  promise: Promise<T> | null | undefined,
): {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
} {
  if (!promise) {
    return {data: undefined, loading: false, error: undefined};
  }

  // Wrap promise to catch errors and convert to a resolved promise with error state
  // React.use() must be called unconditionally and cannot be in try/catch
  const wrappedPromise = promise
    .then((data) => ({data, error: undefined as Error | undefined}))
    .catch((error) => ({
      data: undefined as T | undefined,
      error: error instanceof Error ? error : new Error(String(error)),
    }));

  // Call use() unconditionally (React Hook rule)
  const result = use(wrappedPromise);

  return {
    data: result.data,
    loading: false,
    error: result.error,
  };
}
