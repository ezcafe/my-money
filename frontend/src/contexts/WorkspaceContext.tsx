/**
 * Workspace Context
 * Manages the global active workspace state
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { client } from '../graphql/client';

/**
 * Workspace context interface
 */
interface WorkspaceContextType {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
}

/**
 * Workspace context
 */
const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

/**
 * Workspace context provider props
 */
interface WorkspaceProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'active_workspace_id';

/**
 * Workspace context provider component
 * Manages active workspace state and persists to local storage
 */
export function WorkspaceProvider({ children }: WorkspaceProviderProps): React.JSX.Element {
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => {
    // Initialize from local storage if available
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  /**
   * Clear Apollo cache when workspace changes
   * This ensures all queries refetch with the new workspace context
   */
  useEffect(() => {
    if (activeWorkspaceId !== null) {
      // Clear all cached queries to force refetch with new workspace
      try {
        // cache.reset() is synchronous and returns void
        void client.cache.reset();
      } catch (error) {
        // Silently handle cache reset errors
        console.warn('Failed to reset Apollo cache on workspace change:', error);
      }
    }
  }, [activeWorkspaceId]);

  /**
   * Set active workspace ID and persist to local storage
   */
  const setActiveWorkspaceId = useCallback((id: string | null) => {
    setActiveWorkspaceIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  /**
   * Listen for workspace-cleared events from error handling
   * This ensures the context state is updated when an invalid workspace is cleared
   */
  useEffect(() => {
    const handleWorkspaceCleared = (): void => {
      // Update state to reflect that workspace was cleared
      setActiveWorkspaceIdState(null);
    };

    if (typeof window === 'undefined') {
      // No-op cleanup for SSR
      return () => {
        // No cleanup needed in SSR environment
      };
    }

    window.addEventListener('workspace-cleared', handleWorkspaceCleared);
    return () => {
      window.removeEventListener('workspace-cleared', handleWorkspaceCleared);
    };
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspaceId,
        setActiveWorkspaceId,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Hook to use workspace context
 * @returns Workspace context value
 * @throws Error if used outside WorkspaceProvider
 */
export function useWorkspace(): WorkspaceContextType {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
