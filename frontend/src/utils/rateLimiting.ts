/**
 * Rate Limiting Utility
 * Provides debouncing and throttling for mutations to prevent abuse
 */

/**
 * Debounce a function call
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>): void {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle a function call
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function throttled(...args: Parameters<T>): void {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Create a rate-limited mutation wrapper
 * Prevents multiple rapid calls to the same mutation
 * @param mutationFn - Mutation function to wrap
 * @param options - Rate limiting options
 * @returns Rate-limited mutation function
 */
export function rateLimitMutation<T extends (...args: unknown[]) => unknown>(
  mutationFn: T,
  options: {debounceMs?: number; throttleMs?: number} = {},
): T {
  const {debounceMs, throttleMs} = options;

  if (debounceMs !== undefined) {
    return debounce(mutationFn, debounceMs) as T;
  }

  if (throttleMs !== undefined) {
    return throttle(mutationFn, throttleMs) as T;
  }

  // Default: throttle to 500ms
  return throttle(mutationFn, 500) as T;
}

