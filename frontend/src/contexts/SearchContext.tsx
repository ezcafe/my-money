/**
 * Search Context
 * Provides global search state management across the application
 * Enhanced with search history and suggestions
 */

import React, {createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode} from 'react';

/**
 * Search history entry
 */
interface SearchHistoryEntry {
  query: string;
  timestamp: number;
}

/**
 * Search context interface
 */
interface SearchContextType {
  isSearchOpen: boolean;
  searchQuery: string;
  searchHistory: string[];
  suggestions: string[];
  openSearch: () => void;
  closeSearch: () => void;
  performSearch: (query: string) => void;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  clearHistory: () => void;
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
const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY_ENTRIES = 10;
const MAX_HISTORY_AGE_DAYS = 30;

/**
 * Load search history from localStorage
 */
function loadSearchHistory(): SearchHistoryEntry[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!stored) {
      return [];
    }
    const history = JSON.parse(stored) as SearchHistoryEntry[];
    const now = Date.now();
    const maxAge = MAX_HISTORY_AGE_DAYS * 24 * 60 * 60 * 1000;
    
    // Filter out old entries
    return history.filter((entry) => (now - entry.timestamp) < maxAge);
  } catch {
    return [];
  }
}

/**
 * Save search history to localStorage
 */
function saveSearchHistory(history: SearchHistoryEntry[]): void {
  try {
    // Keep only the most recent entries
    const recent = history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_HISTORY_ENTRIES);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(recent));
  } catch {
    // Ignore localStorage errors
  }
}

export function SearchProvider({children}: SearchProviderProps): React.JSX.Element {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() => loadSearchHistory());

  // Load history on mount
  useEffect(() => {
    setSearchHistory(loadSearchHistory());
  }, []);

  // Generate suggestions from history (matching queries)
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) {
      // Return recent history as suggestions when no query
      return searchHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
        .map((entry) => entry.query);
    }

    // Return history entries that match the current query
    const queryLower = searchQuery.toLowerCase();
    return searchHistory
      .filter((entry) => entry.query.toLowerCase().includes(queryLower))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .map((entry) => entry.query);
  }, [searchQuery, searchHistory]);

  /**
   * Add query to search history
   */
  const addToHistory = useCallback((query: string): void => {
    if (!query.trim()) {
      return;
    }

    setSearchHistory((prev) => {
      // Remove duplicate entries
      const filtered = prev.filter((entry) => entry.query !== query);
      // Add new entry at the beginning
      const updated = [
        {query: query.trim(), timestamp: Date.now()},
        ...filtered,
      ];
      saveSearchHistory(updated);
      return updated;
    });
  }, []);

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
   * Perform search with query (closes search box and adds to history)
   */
  const performSearch = useCallback((query: string) => {
    const trimmedQuery = query.trim();
    setSearchQuery(trimmedQuery);
    if (trimmedQuery) {
      addToHistory(trimmedQuery);
    }
    setIsSearchOpen(false);
  }, [addToHistory]);

  /**
   * Clear search query
   */
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  /**
   * Clear search history
   */
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }, []);

  return (
    <SearchContext.Provider
      value={{
        isSearchOpen,
        searchQuery,
        searchHistory: searchHistory.map((entry) => entry.query),
        suggestions,
        openSearch,
        closeSearch,
        performSearch,
        setSearchQuery: setSearchQueryValue,
        clearSearch,
        clearHistory,
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

