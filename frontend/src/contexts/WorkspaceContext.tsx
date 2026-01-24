/**
 * Workspace Context
 * Manages the global active workspace state
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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
