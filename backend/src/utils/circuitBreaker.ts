/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by stopping requests when a service is down
 */

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening circuit
  resetTimeoutMs: number; // Time to wait before attempting to reset
  monitoringWindowMs: number; // Time window for monitoring failures
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  monitoringWindowMs: 60000, // 1 minute
};

/**
 * Circuit breaker state
 */
type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker for database operations
 */
class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private successCount = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {...DEFAULT_OPTIONS, ...options};
  }

  /**
   * Execute a function with circuit breaker protection
   * @param fn - Function to execute
   * @returns Result of the function
   * @throws Error if circuit is open or function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should be reset
    this.updateState();

    if (this.state === 'open') {
      throw new Error('Circuit breaker is open. Service is unavailable.');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Update circuit breaker state based on current conditions
   */
  private updateState(): void {
    const now = Date.now();

    if (this.state === 'open') {
      // Check if reset timeout has passed
      if (this.lastFailureTime && now - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = 'half-open';
        this.successCount = 0;
      }
    } else if (this.state === 'half-open') {
      // Reset to closed if we've had enough successes
      if (this.successCount >= 2) {
        this.state = 'closed';
        this.failureCount = 0;
      }
    }

    // Reset failure count if monitoring window has passed
    if (this.lastFailureTime && now - this.lastFailureTime >= this.options.monitoringWindowMs) {
      this.failureCount = 0;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
    } else {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    this.updateState();
    return this.state;
  }

  /**
   * Reset circuit breaker (for testing or manual intervention)
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

/**
 * Global circuit breaker instance for database operations
 */
export const dbCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds
  monitoringWindowMs: 60000, // 1 minute
});

/**
 * Execute a database operation with circuit breaker protection
 * @param operation - Database operation to execute
 * @returns Result of the operation
 */
export async function executeWithCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
  return dbCircuitBreaker.execute(operation);
}
