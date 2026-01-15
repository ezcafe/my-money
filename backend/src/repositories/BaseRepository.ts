/**
 * Base Repository
 * Provides common repository functionality for all repositories
 */

import type {PrismaClient} from '@prisma/client';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Base Repository Class
 * Provides common methods for repository operations
 */
export abstract class BaseRepository {
  /**
   * Constructor
   * @param prisma - Prisma client or transaction client
   */
  constructor(protected readonly prisma: PrismaTransaction | PrismaClient) {}
}
