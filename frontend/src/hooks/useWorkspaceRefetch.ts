/**
 * Workspace Refetch Hook
 * Automatically refetches queries when the active workspace changes
 * Reduces code duplication across pages that need to refetch data on workspace change
 */

import { useEffect } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';

/**
 * Options for useWorkspaceRefetch hook
 */
interface UseWorkspaceRefetchOptions {
  /** Refetch functions to call when workspace changes */
  refetchFunctions: Array<() => void | Promise<void> | Promise<unknown>>;
  /** Whether to skip refetching (useful for conditional refetching) */
  skip?: boolean;
}

/**
 * Hook to automatically refetch queries when workspace changes
 * The cache is cleared in WorkspaceContext, but we explicitly refetch to ensure fresh data
 *
 * @param options - Workspace refetch options
 * @example
 * ```tsx
 * const { refetch: refetchBudgets } = useQuery(GET_BUDGETS);
 * const { refetch: refetchAccounts } = useQuery(GET_ACCOUNTS);
 * useWorkspaceRefetch({
 *   refetchFunctions: [refetchBudgets, refetchAccounts]
 * });
 * ```
 */
export function useWorkspaceRefetch(options: UseWorkspaceRefetchOptions): void {
  const { activeWorkspaceId } = useWorkspace();
  const { refetchFunctions, skip = false } = options;

  useEffect(() => {
    if (skip || activeWorkspaceId === null) {
      return;
    }

    // Refetch all provided functions when workspace changes
    for (const refetch of refetchFunctions) {
      void refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, skip]);
}
