/**
 * Header Context
 * Provides global appbar title and action management across the application
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface ActionButton {
  icon: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}

export interface ContextMenu {
  onEdit?: () => void;
  onDelete: () => void;
  disableDelete?: boolean;
}

/**
 * Header context interface
 */
interface HeaderContextType {
  title: string | undefined;
  setTitle: (title: string | undefined) => void;
  actionButton: ActionButton | undefined;
  setActionButton: (action: ActionButton | undefined) => void;
  contextMenu: ContextMenu | undefined;
  setContextMenu: (menu: ContextMenu | undefined) => void;
}

/**
 * Header context
 */
const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

/**
 * Header context provider props
 */
interface HeaderProviderProps {
  children: ReactNode;
}

/**
 * Header context provider component
 * Manages global appbar title and actions state
 */
export function HeaderProvider({ children }: HeaderProviderProps): React.JSX.Element {
  const [title, setTitleState] = useState<string | undefined>(undefined);
  const [actionButton, setActionButtonState] = useState<ActionButton | undefined>(undefined);
  const [contextMenu, setContextMenuState] = useState<ContextMenu | undefined>(undefined);

  /**
   * Set appbar title
   */
  const setTitle = useCallback((newTitle: string | undefined) => {
    setTitleState(newTitle);
  }, []);

  /**
   * Set action button
   */
  const setActionButton = useCallback((newAction: ActionButton | undefined) => {
    setActionButtonState(newAction);
  }, []);

  /**
   * Set context menu
   */
  const setContextMenu = useCallback((newMenu: ContextMenu | undefined) => {
    setContextMenuState(newMenu);
  }, []);

  return (
    <HeaderContext.Provider
      value={{
        title,
        setTitle,
        actionButton,
        setActionButton,
        contextMenu,
        setContextMenu,
      }}
    >
      {children}
    </HeaderContext.Provider>
  );
}

/**
 * Hook to use header context
 * @returns Header context value
 * @throws Error if used outside HeaderProvider
 */
export function useHeader(): HeaderContextType {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
}
