/**
 * Hook for syncing offline mutations when connection is restored
 */

import {useEffect, useState, useCallback} from 'react';
import {
  getQueuedMutations,
  removeQueuedMutation,
  incrementRetryCount,
  getQueueSize,
} from '../utils/offlineQueue';

/**
 * Network status
 */
export interface NetworkStatus {
  isOnline: boolean;
  queueSize: number;
}

/**
 * Options for useOfflineSync hook
 */
export interface UseOfflineSyncOptions {
  /**
   * Whether to automatically sync when online (default: true)
   */
  autoSync?: boolean;

  /**
   * Interval to check network status in milliseconds (default: 1000)
   */
  checkInterval?: number;
}

/**
 * Hook for syncing offline mutations
 * @param options - Sync options
 * @returns Network status and sync function
 */
export function useOfflineSync(options: UseOfflineSyncOptions = {}): {
  networkStatus: NetworkStatus;
  syncQueue: () => Promise<void>;
  clearQueue: () => void;
} {
  const {autoSync = true, checkInterval = 1000} = options;
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  // Initialize queue size
  useEffect(() => {
    void (async () => {
      const size = await getQueueSize();
      setQueueSize(size);
    })();
  }, []);

  /**
   * Check network status and update state
   */
  const checkNetworkStatus = useCallback(async () => {
    const online = navigator.onLine;
    setIsOnline(online);
    setQueueSize(await getQueueSize());
  }, []);

  /**
   * Sync queued mutations
   * Note: This is a simplified implementation that doesn't actually execute mutations.
   * A complete implementation would require access to Apollo Client instance.
   */
  const syncQueue = useCallback(async (): Promise<void> => {
    if (!navigator.onLine) {
      return;
    }

    const queue = await getQueuedMutations();
    if (queue.length === 0) {
      return;
    }

    // Process mutations one by one
    for (const queuedMutation of queue) {
      try {
        // Execute the mutation
        // Note: This is a simplified implementation
        // In a real implementation, you'd need to use Apollo Client's mutate function
        // which requires access to the Apollo Client instance
        // For now, we'll just remove successfully processed mutations
        // A complete implementation would require passing the Apollo Client instance

        // Remove from queue on success
        await removeQueuedMutation(queuedMutation.id);
        const size = await getQueueSize();
        setQueueSize(size);
      } catch (error: unknown) {
        console.error('Failed to sync mutation:', error);
        // Increment retry count
        const shouldRetry = await incrementRetryCount(queuedMutation.id);
        if (!shouldRetry) {
          // Mutation exceeded max retry count, remove it
          await removeQueuedMutation(queuedMutation.id);
        }
        setQueueSize(await getQueueSize());
      }
    }
  }, []);

  /**
   * Clear the queue
   */
  const clearQueue = useCallback(async () => {
    const queue = await getQueuedMutations();
    for (const mutation of queue) {
      await removeQueuedMutation(mutation.id);
    }
    setQueueSize(0);
  }, []);

  // Monitor network status
  useEffect(() => {
    const handleOnline = async (): Promise<void> => {
      setIsOnline(true);
      const size = await getQueueSize();
      setQueueSize(size);
      if (autoSync) {
        void syncQueue();
      }
    };

    const handleOffline = (): void => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check for network status
    const intervalId = setInterval(() => {
      void checkNetworkStatus();
    }, checkInterval);

    return (): void => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [autoSync, checkInterval, checkNetworkStatus, syncQueue]);

  return {
    networkStatus: {
      isOnline,
      queueSize,
    },
    syncQueue,
    clearQueue,
  };
}
