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
  setSearchQuery: (query: string) => void;
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
   * Close search box (does not clear search query)
   */
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  /**
   * Set search query without closing the search box
   */
  const setSearchQueryValue = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  /**
   * Perform search with query (closes search box)
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
        setSearchQuery: setSearchQueryValue,
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

