/**
 * Location Refetch Hook
 * Automatically refetches queries when the location pathname changes to a specific path
 * Useful for refetching data when returning to a page from navigation
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Options for useLocationRefetch hook
 */
interface UseLocationRefetchOptions {
  /** Refetch functions to call when location matches */
  refetchFunctions: Array<() => void | Promise<void> | Promise<unknown>>;
  /** Pathname to watch for (defaults to current location) */
  watchPathname?: string;
  /** Whether to skip refetching */
  skip?: boolean;
}

/**
 * Hook to automatically refetch queries when location pathname changes
 * Useful for refetching data when returning to a page from navigation
 *
 * @param options - Location refetch options
 * @example
 * ```tsx
 * const { refetch } = useCategories();
 * useLocationRefetch({
 *   refetchFunctions: [refetch],
 *   watchPathname: '/categories'
 * });
 * ```
 */
export function useLocationRefetch(options: UseLocationRefetchOptions): void {
  const location = useLocation();
  const { refetchFunctions, watchPathname, skip = false } = options;

  useEffect(() => {
    if (skip) {
      return;
    }

    const targetPathname = watchPathname ?? location.pathname;
    if (location.pathname === targetPathname) {
      // Refetch all provided functions when location matches
      for (const refetch of refetchFunctions) {
        void refetch();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, watchPathname, skip]);
}
