/**
 * Search Filter Hook
 * Filters an array of items based on a search query
 * Provides consistent search filtering logic across list pages
 */

import { useMemo } from 'react';
import { useSearch } from '../contexts/SearchContext';

/**
 * Options for useSearchFilter hook
 */
interface UseSearchFilterOptions<T> {
  /** Array of items to filter */
  items: T[];
  /** Function to extract searchable text from an item */
  getSearchableText: (item: T) => string;
  /** Custom search query (overrides context search query) */
  searchQuery?: string;
}

/**
 * Return type for useSearchFilter hook
 */
interface UseSearchFilterReturn<T> {
  /** Filtered items based on search query */
  filteredItems: T[];
  /** Whether there are search results */
  hasSearchResults: boolean;
  /** Whether there are no search results (search query exists but no matches) */
  hasNoSearchResults: boolean;
  /** Current search query */
  searchQuery: string;
}

/**
 * Hook to filter items based on search query
 * Provides consistent search filtering logic across list pages
 *
 * @param options - Search filter options
 * @returns Filtered items and search state
 * @example
 * ```tsx
 * const { accounts } = useAccounts();
 * const { filteredItems, hasNoSearchResults } = useSearchFilter({
 *   items: accounts,
 *   getSearchableText: (account) => account.name
 * });
 * ```
 */
export function useSearchFilter<T>(
  options: UseSearchFilterOptions<T>
): UseSearchFilterReturn<T> {
  const { searchQuery: contextSearchQuery } = useSearch();
  const { items, getSearchableText, searchQuery: customSearchQuery } = options;

  const searchQuery = customSearchQuery ?? contextSearchQuery;

  /**
   * Filter items based on search query
   */
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return items;
    }
    const query = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      const searchableText = getSearchableText(item);
      return searchableText.toLowerCase().includes(query);
    });
  }, [items, getSearchableText, searchQuery]);

  const hasSearchResults = filteredItems.length > 0;
  const hasNoSearchResults = Boolean(searchQuery.trim() && !hasSearchResults);

  return {
    filteredItems,
    hasSearchResults,
    hasNoSearchResults,
    searchQuery,
  };
}
