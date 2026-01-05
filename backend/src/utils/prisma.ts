/**
 * Prisma client singleton
 * Ensures only one instance of PrismaClient is created
 * Configured with connection pooling and best practices
 */

import {PrismaClient} from '@prisma/client';

interface GlobalForPrisma {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  prisma: PrismaClient | undefined;
}

const globalForPrisma = globalThis as unknown as GlobalForPrisma;

/**
 * Connection pool configuration
 * Best practices for connection pooling:
 * - connection_limit: Maximum number of connections in the pool (100 as requested)
 * - pool_timeout: Maximum time to wait for a connection (20 seconds)
 * - connect_timeout: Maximum time to establish a connection (10 seconds)
 *
 * Note: These can also be configured via DATABASE_URL query parameters:
 * DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=100&pool_timeout=20&connect_timeout=10"
 */
/**
 * Prisma Client with query timeout configuration
 *
 * Query timeouts can be configured at multiple levels:
 * 1. Database connection level: Add ?connect_timeout=10&command_timeout=30 to DATABASE_URL
 * 2. Transaction level: Use $transaction with timeout option
 *    Example: await prisma.$transaction(async (tx) => { ... }, { timeout: 30000 })
 * 3. Connection pool: Configure via DATABASE_URL parameters
 *    Example: ?connection_limit=100&pool_timeout=20
 *
 * Recommended DATABASE_URL format:
 * postgresql://user:pass@host:5432/db?connection_limit=100&pool_timeout=20&connect_timeout=10&command_timeout=30000
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const prisma =
  globalForPrisma.prisma ??
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Connection pool settings and timeouts are configured via DATABASE_URL query parameters
    // See documentation above for recommended timeout values
  });

if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  globalForPrisma.prisma = prisma;
}

/**
 * Disconnect Prisma client
 * Should be called on application shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await prisma.$disconnect();
}


