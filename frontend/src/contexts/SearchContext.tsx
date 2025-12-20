/**
 * Search Context
 * Provides global search state management across the application
 */

import React, {createContext, useContext, useState, useCallback, type ReactNode} from 'react';

/**
 * Search context interface
 */
interface SearchContextType {
  isSearchOpen: boolean;
  searchQuery: string;
  openSearch: () => void;
  closeSearch: () => void;
  performSearch: (query: string) => void;
  clearSearch: () => void;
}

/**
 * Search context
 */
const SearchContext = createContext<SearchContextType | undefined>(undefined);

/**
 * Search context provider props
 */
interface SearchProviderProps {
  children: ReactNode;
}

/**
 * Search context provider component
 * Manages global search state
 */
export function SearchProvider({children}: SearchProviderProps): React.JSX.Element {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Open search box
   */
  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  /**
   * Close search box
   */
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
  }, []);

  /**
   * Perform search with query
   */
  const performSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setIsSearchOpen(false);
  }, []);

  /**
   * Clear search query
   */
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <SearchContext.Provider
      value={{
        isSearchOpen,
        searchQuery,
        openSearch,
        closeSearch,
        performSearch,
        clearSearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

/**
 * Hook to use search context
 * @returns Search context value
 * @throws Error if used outside SearchProvider
 */
export function useSearch(): SearchContextType {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}

