/**
 * Offline Queue Manager
 * Manages offline mutations and background sync
 * Stores failed mutations in IndexedDB for retry
 */

const DB_NAME = 'my-money-offline-queue';
const DB_VERSION = 2; // Incremented to force upgrade if object store is missing
const STORE_NAME = 'mutations';

/**
 * Mutation queue entry
 */
export interface QueuedMutation {
  id: string;
  mutation: string;
  variables: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  error?: string;
}

/**
 * Open IndexedDB database
 * Ensures the object store exists, creating it if necessary
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ? new Error(String(request.error)) : new Error('IndexedDB operation failed'));
    
    request.onsuccess = () => {
      const db = request.result;
      // Check if object store exists after opening
      // If it doesn't exist, we need to delete and recreate the database
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        // Delete the corrupted database
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        deleteRequest.onerror = () => reject(deleteRequest.error ? new Error(String(deleteRequest.error)) : new Error('IndexedDB delete failed'));
        deleteRequest.onsuccess = () => {
          // Reopen with proper structure - this will trigger onupgradeneeded
          const recreateRequest = indexedDB.open(DB_NAME, DB_VERSION);
          recreateRequest.onerror = () => reject(recreateRequest.error ? new Error(String(recreateRequest.error)) : new Error('IndexedDB recreation failed'));
          recreateRequest.onsuccess = () => resolve(recreateRequest.result);
          recreateRequest.onupgradeneeded = (event) => {
            const recreateDb = (event.target as IDBOpenDBRequest).result;
            if (!recreateDb.objectStoreNames.contains(STORE_NAME)) {
              const store = recreateDb.createObjectStore(STORE_NAME, {keyPath: 'id', autoIncrement: false});
              store.createIndex('timestamp', 'timestamp', {unique: false});
              store.createIndex('retryCount', 'retryCount', {unique: false});
            }
          };
        };
      } else {
        resolve(db);
      }
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Only create if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {keyPath: 'id', autoIncrement: false});
        store.createIndex('timestamp', 'timestamp', {unique: false});
        store.createIndex('retryCount', 'retryCount', {unique: false});
      }
    };
  });
}

/**
 * Add mutation to offline queue
 * @param mutation - GraphQL mutation string
 * @param variables - Mutation variables
 * @returns Queue entry ID
 */
export async function queueMutation(
  mutation: string,
  variables: Record<string, unknown>,
): Promise<string> {
  const db = await openDB();
  const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const entry: QueuedMutation = {
    id,
    mutation,
    variables,
    timestamp: Date.now(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(entry);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error ? new Error(String(request.error)) : new Error('IndexedDB operation failed'));
  });
}

/**
 * Get all queued mutations
 * @returns Array of queued mutations
 */
export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  try {
    const db = await openDB();
    // Verify object store exists before using it
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      console.warn('Object store missing, returning empty array');
      return [];
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        const error = request.error ? new Error(String(request.error)) : new Error('IndexedDB operation failed');
        // If object store doesn't exist, return empty array instead of failing
        if (error.message.includes('not a known object store')) {
          console.warn('Object store not found, returning empty array');
          resolve([]);
        } else {
          reject(error);
        }
      };
    });
  } catch (error) {
    // If database can't be opened or object store is missing, return empty array
    console.warn('Failed to get queued mutations:', error);
    return [];
  }
}

/**
 * Remove mutation from queue
 * @param id - Mutation ID
 */
export async function removeQueuedMutation(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ? new Error(String(request.error)) : new Error('IndexedDB operation failed'));
  });
}

/**
 * Update mutation retry count
 * @param id - Mutation ID
 * @param retryCount - New retry count
 * @param error - Optional error message
 */
export async function updateQueuedMutation(
  id: string,
  retryCount: number,
  error?: string,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const entry = getRequest.result as QueuedMutation | undefined;
      if (entry) {
        entry.retryCount = retryCount;
        if (error) {
          entry.error = error;
        }
        const updateRequest = store.put(entry);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error ? new Error(String(updateRequest.error)) : new Error('IndexedDB operation failed'));
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error ? new Error(String(getRequest.error)) : new Error('IndexedDB operation failed'));
  });
}

/**
 * Get queue size
 * @returns Number of queued mutations
 */
export async function getQueueSize(): Promise<number> {
  const mutations = await getQueuedMutations();
  return mutations.length;
}

/**
 * Increment retry count for a mutation
 * @param id - Mutation ID
 * @param maxRetries - Maximum number of retries (default: 5)
 * @returns True if mutation should be retried, false if max retries exceeded
 */
export async function incrementRetryCount(id: string, maxRetries: number = 5): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const entry = getRequest.result as QueuedMutation | undefined;
      if (entry) {
        entry.retryCount = (entry.retryCount ?? 0) + 1;
        const shouldRetry = entry.retryCount <= maxRetries;
        const updateRequest = store.put(entry);
        updateRequest.onsuccess = () => resolve(shouldRetry);
        updateRequest.onerror = () => reject(updateRequest.error ? new Error(String(updateRequest.error)) : new Error('IndexedDB operation failed'));
      } else {
        resolve(false);
      }
    };
    getRequest.onerror = () => reject(getRequest.error ? new Error(String(getRequest.error)) : new Error('IndexedDB operation failed'));
  });
}

/**
 * Clear all queued mutations
 */
export async function clearQueuedMutations(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ? new Error(String(request.error)) : new Error('IndexedDB operation failed'));
  });
}
