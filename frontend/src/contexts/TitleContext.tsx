/**
 * Title Context
 * Provides global appbar title management across the application
 */

import React, {createContext, useContext, useState, useCallback, type ReactNode} from 'react';

/**
 * Title context interface
 */
interface TitleContextType {
  title: string | undefined;
  setTitle: (title: string | undefined) => void;
}

/**
 * Title context
 */
const TitleContext = createContext<TitleContextType | undefined>(undefined);

/**
 * Title context provider props
 */
interface TitleProviderProps {
  children: ReactNode;
}

/**
 * Title context provider component
 * Manages global appbar title state
 */
export function TitleProvider({children}: TitleProviderProps): React.JSX.Element {
  const [title, setTitleState] = useState<string | undefined>(undefined);

  /**
   * Set appbar title
   */
  const setTitle = useCallback((newTitle: string | undefined) => {
    setTitleState(newTitle);
  }, []);

  return (
    <TitleContext.Provider
      value={{
        title,
        setTitle,
      }}
    >
      {children}
    </TitleContext.Provider>
  );
}

/**
 * Hook to use title context
 * @returns Title context value
 * @throws Error if used outside TitleProvider
 */
export function useTitle(): TitleContextType {
  const context = useContext(TitleContext);
  if (context === undefined) {
    throw new Error('useTitle must be used within a TitleProvider');
  }
  return context;
}

