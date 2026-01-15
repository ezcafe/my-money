/**
 * Offline Queue Utility
 * Manages queued mutations when the app is offline
 */

/**
 * Queued mutation entry
 */
export interface QueuedMutation {
  id: string;
  mutation: string; // GraphQL mutation document as string
  variables: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  conflictResolutionStrategy?: string; // Strategy name for conflict resolution
}

const QUEUE_STORAGE_KEY = 'offline_mutation_queue';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_COUNT = 3;

/**
 * Get all queued mutations from storage
 */
export function getQueuedMutations(): QueuedMutation[] {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as QueuedMutation[];
  } catch {
    return [];
  }
}

/**
 * Save queued mutations to storage
 */
export function saveQueuedMutations(mutations: QueuedMutation[]): void {
  try {
    // Limit queue size to prevent storage overflow
    const limitedMutations = mutations.slice(0, MAX_QUEUE_SIZE);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(limitedMutations));
  } catch (error) {
    console.error('Failed to save queued mutations:', error);
  }
}

/**
 * Add a mutation to the offline queue
 * @param mutation - GraphQL mutation document as string
 * @param variables - Mutation variables
 * @param conflictResolutionStrategy - Optional conflict resolution strategy name
 * @returns Mutation ID
 */
export function queueMutation(
  mutation: string,
  variables: Record<string, unknown>,
  conflictResolutionStrategy?: string,
): string {
  const id = `mutation_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const queuedMutation: QueuedMutation = {
    id,
    mutation,
    variables,
    timestamp: Date.now(),
    retryCount: 0,
    conflictResolutionStrategy,
  };

  const queue = getQueuedMutations();
  queue.push(queuedMutation);
  saveQueuedMutations(queue);

  return id;
}

/**
 * Remove a mutation from the queue
 */
export function removeQueuedMutation(id: string): void {
  const queue = getQueuedMutations();
  const filtered = queue.filter((m) => m.id !== id);
  saveQueuedMutations(filtered);
}

/**
 * Clear all queued mutations
 */
export function clearQueuedMutations(): void {
  localStorage.removeItem(QUEUE_STORAGE_KEY);
}

/**
 * Get the number of queued mutations
 */
export function getQueueSize(): number {
  return getQueuedMutations().length;
}

/**
 * Increment retry count for a mutation
 */
export function incrementRetryCount(id: string): boolean {
  const queue = getQueuedMutations();
  const mutation = queue.find((m) => m.id === id);
  if (!mutation) {
    return false;
  }

  mutation.retryCount++;
  if (mutation.retryCount > MAX_RETRY_COUNT) {
    // Remove mutations that have exceeded max retry count
    removeQueuedMutation(id);
    return false;
  }

  saveQueuedMutations(queue);
  return true;
}
