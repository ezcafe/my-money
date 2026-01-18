/**
 * Base Repository
 * Provides common repository functionality for all repositories
 */

import type {PrismaClient} from '@prisma/client';

export type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Base Repository Class
 * Provides common CRUD methods and helper utilities for repository operations
 * Subclasses can use these methods to reduce code duplication
 */
export abstract class BaseRepository {
  /**
   * Constructor
   * @param prisma - Prisma client or transaction client
   */
  constructor(protected readonly prisma: PrismaTransaction | PrismaClient) {}

  /**
   * Helper method to build query options with select/include
   * Reduces code duplication in findById and findMany methods
   * @param where - Where clause
   * @param options - Optional select or include
   * @returns Query options object
   */
  protected buildQueryOptions<T>(
    where: T,
    options?: {
      select?: Record<string, boolean>;
      include?: Record<string, boolean>;
    },
  ): {
    where: T;
    select?: Record<string, boolean>;
    include?: Record<string, boolean>;
  } {
    const queryOptions: {
      where: T;
      select?: Record<string, boolean>;
      include?: Record<string, boolean>;
    } = {
      where,
    };

    if (options?.select) {
      queryOptions.select = options.select;
    } else if (options?.include) {
      queryOptions.include = options.include;
    }

    return queryOptions;
  }

  /**
   * Helper method to get the appropriate Prisma client (transaction or regular)
   * @param tx - Optional transaction client
   * @returns Prisma client to use
   */
  protected getClient(tx?: PrismaTransaction): PrismaTransaction | PrismaClient {
    return tx ?? this.prisma;
  }

  /**
   * Common findById pattern for entities with workspaceId
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param id - Entity ID
   * @param workspaceId - Workspace ID
   * @param options - Optional select or include
   * @returns Entity if found, null otherwise
   */
  protected async findByIdWithWorkspace<T>(
    delegate: {
      findFirst: (args: {
        where: {id: string; workspaceId: string};
        select?: Record<string, boolean>;
        include?: Record<string, boolean>;
      }) => Promise<T | null>;
    },
    id: string,
    workspaceId: string,
    options?: {
      select?: Record<string, boolean>;
      include?: Record<string, boolean>;
    },
  ): Promise<T | null> {
    return delegate.findFirst(this.buildQueryOptions({id, workspaceId}, options));
  }

  /**
   * Common findMany pattern for entities with workspaceId
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param workspaceId - Workspace ID
   * @param options - Optional select, skip, take, orderBy
   * @returns Array of entities
   */
  protected async findManyWithWorkspace<T, O = unknown>(
    delegate: {
      findMany: (args: {
        where: {workspaceId: string};
        select?: Record<string, boolean>;
        skip?: number;
        take?: number;
        orderBy?: O;
      }) => Promise<T[]>;
    },
    workspaceId: string,
    options?: {
      select?: Record<string, boolean>;
      skip?: number;
      take?: number;
      orderBy?: O;
    },
  ): Promise<T[]> {
    const queryOptions: {
      where: {workspaceId: string};
      select?: Record<string, boolean>;
      skip?: number;
      take?: number;
      orderBy?: O;
    } = {
      where: {workspaceId},
    };

    if (options?.select) {
      queryOptions.select = options.select;
    }
    if (options?.skip !== undefined) {
      queryOptions.skip = options.skip;
    }
    if (options?.take !== undefined) {
      queryOptions.take = options.take;
    }
    if (options?.orderBy) {
      queryOptions.orderBy = options.orderBy;
    }

    return delegate.findMany(queryOptions);
  }

  /**
   * Common create pattern
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param data - Entity data
   * @param tx - Optional transaction client
   * @returns Created entity
   */
  protected async createEntity<T, D>(
    delegate: {
      create: (args: {data: D}) => Promise<T>;
    },
    data: D,
    _tx?: PrismaTransaction,
  ): Promise<T> {
    // For transaction client, we need to get the delegate from the transaction
    // This is a simplified version - in practice, repositories should pass the delegate directly
    return delegate.create({data});
  }

  /**
   * Common update pattern
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param id - Entity ID
   * @param data - Entity data to update
   * @param tx - Optional transaction client
   * @returns Updated entity
   */
  protected async updateEntity<T, D>(
    delegate: {
      update: (args: {where: {id: string}; data: D}) => Promise<T>;
    },
    id: string,
    data: D,
    _tx?: PrismaTransaction,
  ): Promise<T> {
    return delegate.update({
      where: {id},
      data,
    });
  }

  /**
   * Common delete pattern
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param id - Entity ID
   * @param tx - Optional transaction client
   * @returns Deleted entity
   */
  protected async deleteEntity<T>(
    delegate: {
      delete: (args: {where: {id: string}}) => Promise<T>;
    },
    id: string,
    _tx?: PrismaTransaction,
  ): Promise<T> {
    return delegate.delete({
      where: {id},
    });
  }

  /**
   * Common count pattern for entities with workspaceId
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param workspaceId - Workspace ID
   * @returns Count of entities
   */
  protected async countWithWorkspace(
    delegate: {
      count: (args: {where: {workspaceId: string}}) => Promise<number>;
    },
    workspaceId: string,
  ): Promise<number> {
    return delegate.count({
      where: {workspaceId},
    });
  }

  /**
   * Check if entity exists by ID
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param id - Entity ID
   * @param workspaceId - Workspace ID (optional)
   * @returns True if entity exists, false otherwise
   */
  protected async existsById(
    delegate: {
      findFirst: (args: {
        where: {id: string; workspaceId?: string};
        select?: {id: boolean};
      }) => Promise<{id: string} | null>;
    },
    id: string,
    workspaceId?: string,
  ): Promise<boolean> {
    const where: {id: string; workspaceId?: string} = {id};
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }
    const result = await delegate.findFirst({
      where,
      select: {id: true},
    });
    return result !== null;
  }

  /**
   * Find first entity matching criteria (generic helper)
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param where - Where clause
   * @param options - Optional select or include
   * @returns Entity if found, null otherwise
   */
  protected async findFirstEntity<T, W>(
    delegate: {
      findFirst: (args: {
        where: W;
        select?: Record<string, boolean>;
        include?: Record<string, boolean>;
      }) => Promise<T | null>;
    },
    where: W,
    options?: {
      select?: Record<string, boolean>;
      include?: Record<string, boolean>;
    },
  ): Promise<T | null> {
    return delegate.findFirst(this.buildQueryOptions(where, options));
  }

  /**
   * Upsert entity (create or update)
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param where - Where clause for finding existing entity
   * @param create - Data to create if entity doesn't exist
   * @param update - Data to update if entity exists
   * @param tx - Optional transaction client
   * @returns Created or updated entity
   */
  protected async upsertEntity<T, W, D>(
    delegate: {
      upsert: (args: {
        where: W;
        create: D;
        update: D;
      }) => Promise<T>;
    },
    where: W,
    create: D,
    update: D,
    _tx?: PrismaTransaction,
  ): Promise<T> {
    return delegate.upsert({
      where,
      create,
      update,
    });
  }

  /**
   * Delete many entities matching criteria
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param where - Where clause
   * @param tx - Optional transaction client
   * @returns Count of deleted entities
   */
  protected async deleteMany<W>(
    delegate: {
      deleteMany: (args: {where: W}) => Promise<{count: number}>;
    },
    where: W,
    _tx?: PrismaTransaction,
  ): Promise<number> {
    const result = await delegate.deleteMany({where});
    return result.count;
  }

  /**
   * Update many entities matching criteria (generic helper)
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param where - Where clause
   * @param data - Data to update
   * @param tx - Optional transaction client
   * @returns Count of updated entities
   */
  protected async updateManyEntities<W, D>(
    delegate: {
      updateMany: (args: {where: W; data: D}) => Promise<{count: number}>;
    },
    where: W,
    data: D,
    _tx?: PrismaTransaction,
  ): Promise<number> {
    const result = await delegate.updateMany({where, data});
    return result.count;
  }

  /**
   * Count entities matching criteria (generic helper)
   * @param delegate - Prisma model delegate (e.g., this.prisma.account)
   * @param where - Where clause
   * @returns Count of entities
   */
  protected async countEntities<W>(
    delegate: {
      count: (args: {where: W}) => Promise<number>;
    },
    where: W,
  ): Promise<number> {
    return delegate.count({where});
  }
}
