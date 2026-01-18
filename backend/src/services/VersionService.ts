/**
 * Version Service
 * Handles version tracking, conflict detection, and version history management
 */

import type {PrismaClient, Prisma} from '@prisma/client';
import {prisma} from '../utils/prisma';
import {ConflictError} from '../utils/errors';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export type EntityType = 'Account' | 'Category' | 'Payee' | 'Transaction' | 'Budget';

/**
 * Version Service Class
 * Provides methods for creating version snapshots, detecting conflicts, and managing version history
 */
export class VersionService {
  /**
   * Create a version snapshot of an entity before update
   * @param entityType - Type of entity (Account, Category, Payee, Transaction, Budget)
   * @param entityId - Entity ID
   * @param previousData - Previous entity data (before update)
   * @param newData - New entity data (after update)
   * @param editedBy - User ID who made the edit
   * @param tx - Optional transaction client
   * @returns Created EntityVersion record
   */
  async createVersion(
    entityType: EntityType,
    entityId: string,
    previousData: Record<string, unknown>,
    newData: Record<string, unknown>,
    editedBy: string,
    tx?: PrismaTransaction,
  ) {
    const client = tx ?? prisma;

    // Get current version from entity
    const currentVersion = (newData.version as number) ?? 1;

    // Create version snapshot with previous data
    return client.entityVersion.create({
      data: {
        entityType,
        entityId,
        version: currentVersion - 1, // Store previous version
        data: previousData as Prisma.InputJsonValue,
        editedBy,
      },
    });
  }

  /**
   * Get version history for an entity
   * @param entityType - Type of entity
   * @param entityId - Entity ID
   * @param limit - Maximum number of versions to return (default: 50)
   * @returns Array of EntityVersion records
   */
  async getEntityVersions(entityType: EntityType, entityId: string, limit = 50) {
    return prisma.entityVersion.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: {
        version: 'desc',
      },
      take: limit,
      include: {
        editor: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get a specific version of an entity
   * @param entityType - Type of entity
   * @param entityId - Entity ID
   * @param version - Version number
   * @returns EntityVersion record or null
   */
  async getEntityVersion(entityType: EntityType, entityId: string, version: number) {
    return prisma.entityVersion.findUnique({
      where: {
        entityType_entityId_version: {
          entityType,
          entityId,
          version,
        },
      },
      include: {
        editor: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Check for conflicts when updating an entity
   * Uses optimistic locking: if expectedVersion doesn't match current version, a conflict exists
   * @param entityType - Type of entity
   * @param entityId - Entity ID
   * @param currentVersion - Current version from database
   * @param expectedVersion - Expected version from client
   * @param currentData - Current entity data from database
   * @param incomingData - Incoming entity data from client
   * @param workspaceId - Workspace ID
   * @param tx - Optional transaction client
   * @returns EntityConflict record if conflict detected, null otherwise
   */
  async checkForConflict(
    entityType: EntityType,
    entityId: string,
    currentVersion: number,
    expectedVersion: number | undefined,
    currentData: Record<string, unknown>,
    incomingData: Record<string, unknown>,
    workspaceId: string,
    tx?: PrismaTransaction,
  ) {
    // If no expectedVersion provided, assume no conflict (first update)
    if (expectedVersion === undefined) {
      return null;
    }

    // If versions match, no conflict
    if (currentVersion === expectedVersion) {
      return null;
    }

    // Version mismatch detected - create conflict record
    const client = tx ?? prisma;

    // Get the previous version data from EntityVersion table
    const previousVersion = await client.entityVersion.findUnique({
      where: {
        entityType_entityId_version: {
          entityType,
          entityId,
          version: expectedVersion,
        },
      },
    });

    const conflict = await client.entityConflict.create({
      data: {
        entityType,
        entityId,
        currentVersion,
        incomingVersion: expectedVersion,
        currentData: currentData as Prisma.InputJsonValue,
        incomingData: (previousVersion?.data ?? incomingData) as Prisma.InputJsonValue,
        workspaceId,
      },
    });

    // Emit conflict event for subscriptions
    const {publishConflictDetected} = await import('../resolvers/SubscriptionResolver');
    publishConflictDetected(conflict);

    // Throw error to prevent update
    throw new ConflictError('Entity has been modified by another user', {
      conflictId: conflict.id,
      currentVersion,
      expectedVersion,
      currentData,
      incomingData: (previousVersion?.data ?? incomingData) as Record<string, unknown>,
    });
  }

  /**
   * Resolve a conflict by choosing a version
   * @param conflictId - Conflict ID
   * @param resolvedVersion - Version to use (currentVersion or incomingVersion)
   * @param resolvedBy - User ID who resolved the conflict
   * @param mergeData - Optional merged data (for manual merge)
   * @param tx - Optional transaction client
   * @returns Updated EntityConflict record
   */
  async resolveConflict(
    conflictId: string,
    resolvedVersion: number,
    resolvedBy: string,
    mergeData?: Record<string, unknown>,
    tx?: PrismaTransaction,
  ) {
    const client = tx ?? prisma;

    const conflict = await client.entityConflict.findUnique({
      where: {id: conflictId},
    });

    if (!conflict) {
      throw new Error('Conflict not found');
    }

    if (conflict.resolvedAt) {
      throw new Error('Conflict already resolved');
    }

    return client.entityConflict.update({
      where: {id: conflictId},
      data: {
        resolvedAt: new Date(),
        resolvedBy,
        resolvedVersion,
        // If mergeData provided, update currentData with merged values
        ...(mergeData && {currentData: mergeData as Prisma.InputJsonValue}),
      },
    });
  }

  /**
   * Get unresolved conflicts for a workspace
   * @param workspaceId - Workspace ID
   * @returns Array of unresolved EntityConflict records
   */
  async getUnresolvedConflicts(workspaceId: string) {
    return prisma.entityConflict.findMany({
      where: {
        workspaceId,
        resolvedAt: null,
      },
      orderBy: {
        detectedAt: 'desc',
      },
      include: {
        resolver: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get conflict by ID
   * @param conflictId - Conflict ID
   * @returns EntityConflict record or null
   */
  async getConflict(conflictId: string) {
    return prisma.entityConflict.findUnique({
      where: {id: conflictId},
      include: {
        resolver: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }
}
