/**
 * Prisma client singleton
 * Ensures only one instance of PrismaClient is created
 * Configured with connection pooling and best practices
 *
 * Prisma 7+ requires using an adapter for database connections
 */

import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {Pool} from 'pg';

interface GlobalForPrisma {
   
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
// Create PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 100, // Maximum number of clients in the pool
  connectionTimeoutMillis: 10000, // 10 seconds
  idleTimeoutMillis: 30000, // 30 seconds
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

 
export const prisma =
  globalForPrisma.prisma ??
   
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Connection pool settings and timeouts are configured via DATABASE_URL query parameters
    // See documentation above for recommended timeout values
  });

if (process.env.NODE_ENV !== 'production') {
   
  globalForPrisma.prisma = prisma;
}

/**
 * Disconnect Prisma client
 * Should be called on application shutdown
 */
export async function disconnectPrisma(): Promise<void> {
   
  await prisma.$disconnect();
}


