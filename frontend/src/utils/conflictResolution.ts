/**
 * Conflict Resolution Strategies
 * Provides strategies for resolving conflicts in offline mutations
 */

/**
 * Conflict resolution strategy interface
 */
export interface ConflictResolutionStrategy<T> {
  /**
   * Resolve conflict between local and server data
   * @param local - Local data (from offline queue)
   * @param server - Server data (from API response)
   * @returns Resolved data
   */
  resolve(local: T, server: T): T;
}

/**
 * Last Write Wins Strategy
 * Server data always wins (default strategy)
 */
export class LastWriteWinsStrategy<T> implements ConflictResolutionStrategy<T> {
  /**
   * Resolve conflict by using server data
   * @param _local - Local data (ignored)
   * @param server - Server data
   * @returns Server data
   */
  resolve(_local: T, server: T): T {
    return server;
  }
}

/**
 * Merge Strategy
 * Merges local and server data
 */
export class MergeStrategy<
  T extends Record<string, unknown>,
> implements ConflictResolutionStrategy<T> {
  /**
   * Resolve conflict by merging local and server data
   * @param local - Local data
   * @param server - Server data
   * @returns Merged data
   */
  resolve(local: T, server: T): T {
    return {
      ...local,
      ...server,
      updatedAt: new Date().toISOString(),
    } as T;
  }
}

/**
 * Local Wins Strategy
 * Local data always wins (use with caution)
 */
export class LocalWinsStrategy<T> implements ConflictResolutionStrategy<T> {
  /**
   * Resolve conflict by using local data
   * @param local - Local data
   * @param _server - Server data (ignored)
   * @returns Local data
   */
  resolve(local: T, _server: T): T {
    return local;
  }
}

/**
 * Timestamp-based Strategy
 * Uses the most recent timestamp to determine winner
 */
export class TimestampStrategy<
  T extends { updatedAt?: string; createdAt?: string },
> implements ConflictResolutionStrategy<T> {
  /**
   * Resolve conflict by comparing timestamps
   * @param local - Local data
   * @param server - Server data
   * @returns Data with most recent timestamp
   */
  resolve(local: T, server: T): T {
    const localTime = local.updatedAt ?? local.createdAt ?? '0';
    const serverTime = server.updatedAt ?? server.createdAt ?? '0';

    return new Date(localTime) > new Date(serverTime) ? local : server;
  }
}

/**
 * Default conflict resolution strategy factory
 * @returns Default strategy (Last Write Wins)
 */
export function getDefaultConflictStrategy<T>(): ConflictResolutionStrategy<T> {
  return new LastWriteWinsStrategy<T>();
}
