/**
 * useResizeObserver Hook
 * Wraps the ResizeObserver API for responsive D3 chart sizing.
 * Follows the same pattern as sure app's Stimulus controllers (ResizeObserver + redraw).
 */

import { useState, useEffect, useCallback, type RefObject } from 'react';

/** Dimensions returned by the hook */
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Custom hook that observes an element's size and returns its dimensions.
 * Uses ResizeObserver for efficient resize detection.
 *
 * @param ref - React ref to the DOM element to observe
 * @returns Current width and height of the observed element
 */
export function useResizeObserver(ref: RefObject<HTMLElement | null>): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });

  const updateDimensions = useCallback(() => {
    if (ref.current) {
      const { clientWidth, clientHeight } = ref.current;
      setDimensions((prev) => {
        if (prev.width === clientWidth && prev.height === clientHeight) {
          return prev;
        }
        return { width: clientWidth, height: clientHeight };
      });
    }
  }, [ref]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Set initial dimensions
    updateDimensions();

    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, updateDimensions]);

  return dimensions;
}
