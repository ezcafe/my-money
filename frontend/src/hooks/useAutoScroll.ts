/**
 * Custom hook for auto-scrolling to bottom when new items are added
 * Handles both initial scroll on load and auto-scroll when new items are detected
 */

import {useEffect, useRef} from 'react';

/**
 * Item with ID for tracking new additions
 */
interface ItemWithId {
  id: string;
}

/**
 * Options for auto-scroll behavior
 */
interface UseAutoScrollOptions {
  /**
   * Delay in milliseconds before scrolling (default: 300)
   */
  scrollDelay?: number;
  /**
   * Whether to enable smooth scrolling (default: true)
   */
  smooth?: boolean;
}

/**
 * Custom hook to auto-scroll to bottom when new items are added
 * @param scrollRef - Ref to the scrollable container element
 * @param items - Array of items to monitor (ordered with newest first)
 * @param isLoading - Whether data is currently loading
 * @param options - Optional configuration for scroll behavior
 */
export function useAutoScroll<T extends ItemWithId>(
  scrollRef: React.RefObject<HTMLElement | null>,
  items: T[],
  isLoading: boolean,
  options: UseAutoScrollOptions = {},
): void {
  const {scrollDelay = 300, smooth = true} = options;
  const hasScrolledOnLoad = useRef(false);
  const previousItemsLength = useRef(0);
  const previousNewestItemId = useRef<string | null>(null);
  const itemsBeforeLoading = useRef<{length: number; newestId: string | null} | null>(null);

  /**
   * Scroll to bottom on initial load when data is ready
   * Uses smooth animation for a polished user experience
   */
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    if (!isLoading && items.length > 0 && !hasScrolledOnLoad.current) {
      // Mark that we've done the initial scroll
      hasScrolledOnLoad.current = true;
      // Use setTimeout to ensure DOM layout is complete after React render
      // Delay ensures content is fully rendered before scrolling
      timeoutId = setTimeout(() => {
        if (scrollRef.current) {
          const element = scrollRef.current;
          element.scrollTo({
            top: element.scrollHeight,
            behavior: smooth ? 'smooth' : 'instant',
          });
        }
      }, scrollDelay);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading, items.length, scrollRef, scrollDelay, smooth]);

  /**
   * Auto-scroll to bottom when a new item is added
   * Detects when a new item is added by checking the newest item ID
   * (items are ordered with newest first)
   */
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    // Skip if this is the initial load (before first scroll)
    if (!hasScrolledOnLoad.current) {
      previousItemsLength.current = items.length;
      previousNewestItemId.current = items.length > 0 ? items[0]?.id ?? null : null;
      // Store items state when loading starts
      if (isLoading) {
        itemsBeforeLoading.current = {
          length: items.length,
          newestId: items.length > 0 ? items[0]?.id ?? null : null,
        };
      }
      return;
    }

    // Get the newest item ID (first item since ordered with newest first)
    const newestItemId = items.length > 0 ? items[0]?.id ?? null : null;
    
    // When loading starts, store the current state for comparison later
    if (isLoading && !itemsBeforeLoading.current) {
      itemsBeforeLoading.current = {
        length: previousItemsLength.current,
        newestId: previousNewestItemId.current,
      };
    }
    
    // When loading finishes, check if items changed during the load
    if (!isLoading && itemsBeforeLoading.current) {
      const itemsChangedDuringLoad = items.length !== itemsBeforeLoading.current.length ||
                                     newestItemId !== itemsBeforeLoading.current.newestId;
      
      if (itemsChangedDuringLoad) {
        timeoutId = setTimeout(() => {
          if (scrollRef.current) {
            const element = scrollRef.current;
            element.scrollTo({
              top: element.scrollHeight,
              behavior: smooth ? 'smooth' : 'instant',
            });
          }
        }, scrollDelay);
      }
      
      // Clear the stored state
      itemsBeforeLoading.current = null;
    }
    
    // Check for changes when not loading (for cases where loading state doesn't change)
    if (!isLoading && !itemsBeforeLoading.current) {
      const itemCountIncreased = items.length > previousItemsLength.current;
      const newItemAdded = newestItemId !== null && 
                          newestItemId !== previousNewestItemId.current;

      if (newItemAdded || itemCountIncreased) {
        timeoutId = setTimeout(() => {
          if (scrollRef.current) {
            const element = scrollRef.current;
            element.scrollTo({
              top: element.scrollHeight,
              behavior: smooth ? 'smooth' : 'instant',
            });
          }
        }, scrollDelay);
      }
    }
    
    // Update refs for next comparison (only when not loading to avoid updating during refetch)
    if (!isLoading) {
      previousItemsLength.current = items.length;
      previousNewestItemId.current = newestItemId;
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [items, isLoading, scrollRef, scrollDelay, smooth]);
}

