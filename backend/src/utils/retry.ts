/**
 * Retry Utility
 * Provides retry logic with exponential backoff for failed operations
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'retryableErrors'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    retryableErrors,
  } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (retryableErrors && !retryableErrors(lastError)) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Wait before retrying (exponential backoff)
      await sleep(Math.min(delay, maxDelayMs));
      delay *= backoffMultiplier;
    }
  }

  // All retries exhausted
  throw lastError!;
}

/**
 * Check if an error is retryable (network errors, timeouts, etc.)
 * @param error - Error to check
 * @returns true if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  // Retry on network errors, timeouts, and database connection errors
  const retryablePatterns = [
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /timeout/i,
    /connection/i,
    /deadlock/i,
    /P1001/i, // Prisma connection error
    /P1008/i, // Prisma operation timeout
  ];

  return retryablePatterns.some((pattern) => pattern.test(error.message));
}
