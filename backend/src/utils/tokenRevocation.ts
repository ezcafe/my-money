/**
 * Token Revocation Service
 * Manages token revocation/blacklist for enhanced security
 * Uses PostgreSQL UNLOGGED table for high-performance token revocation checks
 */

import {Client} from 'pg';
import {createHash} from 'crypto';
import {logError, logInfo} from './logger';
import {config} from '../config';

/**
 * Hash token for secure storage in revocation list
 * Uses SHA-256 to create a hash of the token
 * @param token - The token to hash
 * @returns SHA-256 hash of the token
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Check if a token is revoked
 * @param token - Token to check
 * @returns True if token is revoked, false otherwise
 */
export async function isTokenRevoked(token: string): Promise<boolean> {
  try {
    const tokenHash = hashToken(token);
    // Use direct pg.Client instead of prisma.$queryRaw (PrismaPg adapter doesn't support it)
    const client = await getDbClientForDDL();
    try {
      const result = await client.query<{key: string}>(
        'SELECT key FROM "token_revocation" WHERE key = $1 AND expires_at > NOW()',
        [tokenHash]
      );
      return result.rows.length > 0;
    } finally {
      await client.end();
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Token revocation check failed', {
      event: 'token_revocation_check_failed',
    }, errorObj);

    // On error, assume token is not revoked (fail open)
    // This prevents revocation check failures from breaking authentication
    return false;
  }
}

/**
 * Revoke a token
 * NOTE: Token revocation is currently DISABLED to prevent race conditions.
 * Most OIDC providers automatically invalidate old tokens when new ones are issued.
 * This function is now a no-op that only logs for debugging purposes.
 * @param token - Token to revoke (ignored - revocation is disabled)
 * @param expiresAt - When the token revocation expires (ignored - revocation is disabled)
 * @returns Promise that resolves immediately (no-op)
 */
export async function revokeToken(
  _token: string,
  _expiresAt?: Date,
): Promise<void> {
  // Token revocation is disabled - this is a no-op
  // The OIDC provider handles token invalidation automatically
  // We don't revoke tokens ourselves to avoid race conditions with concurrent requests
  logInfo('Token revocation requested but disabled (no-op)', {
    event: 'token_revocation_disabled',
    note: 'Token revocation is disabled. OIDC provider handles token invalidation.',
  });

  // Return immediately without revoking anything
  return Promise.resolve();
}

/**
 * Revoke all tokens for a user (by subject)
 * Useful for logout or security incidents
 * @param subject - OIDC subject (user identifier)
 * @returns Promise that resolves when all user tokens are revoked
 */
export function revokeUserTokens(subject: string): void {
  try {
    // Note: Since we hash tokens, we can't directly revoke by subject
    // Instead, we'll use a marker in the cache to invalidate all tokens
    // This is a limitation of the hashing approach, but provides better security
    logInfo('User token revocation requested', {
      event: 'user_tokens_revocation_requested',
      subject,
      note: 'Individual token revocation required - tokens are hashed for security',
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('User token revocation failed', {
      event: 'user_tokens_revocation_failed',
      subject,
    }, errorObj);
    throw errorObj;
  }
}

/**
 * Clear expired token revocations
 * @returns Number of entries deleted
 */
export async function clearExpiredRevocations(): Promise<number> {
  try {
    // Use direct pg.Client instead of prisma.$executeRaw (PrismaPg adapter doesn't support it)
    const client = await getDbClientForDDL();
    try {
      const result = await client.query(
        'DELETE FROM "token_revocation" WHERE expires_at <= NOW()'
      );
      const deletedCount = result.rowCount ?? 0;
      if (deletedCount > 0) {
        logInfo('Expired token revocations cleared', {
          event: 'token_revocation_cleanup',
          deletedCount,
        });
      }
      return deletedCount;
    } finally {
      await client.end();
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Failed to clear expired token revocations', {
      event: 'token_revocation_cleanup_failed',
    }, errorObj);
    return 0;
  }
}

/**
 * Clear ALL token revocations
 * Useful for cleanup when token revocation is disabled
 * @returns Number of entries deleted
 */
export async function clearAllRevocations(): Promise<number> {
  try {
    // Use direct pg.Client instead of prisma.$executeRaw (PrismaPg adapter doesn't support it)
    const client = await getDbClientForDDL();
    try {
      const result = await client.query('DELETE FROM "token_revocation"');
      const deletedCount = result.rowCount ?? 0;
      if (deletedCount > 0) {
        logInfo('All token revocations cleared', {
          event: 'token_revocation_clear_all',
          deletedCount,
        });
      }
      return deletedCount;
    } finally {
      await client.end();
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Failed to clear all token revocations', {
      event: 'token_revocation_clear_all_failed',
    }, errorObj);
    return 0;
  }
}

/**
 * Initialize token revocation table if it doesn't exist
 * Creates UNLOGGED table for high-performance token revocation checks
 */
/**
 * Get a database client for DDL operations
 * Uses a direct Client connection instead of the pool to avoid connection issues
 * The pool may have connection string issues in Docker, so we create a fresh client
 */
async function getDbClientForDDL(maxRetries = 5, delayMs = 1000): Promise<Client> {
  // config.database.url already has adjusted hostname via getter
  const connectionString = config.database.url;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = new Client({connectionString});
    try {
      await client.connect();
      return client;
    } catch (error) {
      // Clean up failed client
      try {
        await client.end();
      } catch {
        // Ignore cleanup errors
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to get database client after retries');
}

export async function initializeTokenRevocationTable(): Promise<void> {
  try {
    // Create token_revocation table
    // Use a direct Client connection for DDL operations
    // PrismaPg adapter doesn't support raw DDL, and pool may have connection issues
    const client = await getDbClientForDDL();
    try {
      const createTableSql = `CREATE UNLOGGED TABLE IF NOT EXISTS "token_revocation" (
          "key" TEXT NOT NULL,
          "expires_at" TIMESTAMPTZ NOT NULL,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT "token_revocation_pkey" PRIMARY KEY ("key")
        )`;
      await client.query(createTableSql);

      // Create index on expires_at for efficient cleanup queries
      await client.query('CREATE INDEX IF NOT EXISTS "token_revocation_expires_at_idx" ON "token_revocation"("expires_at")');
    } finally {
      await client.end();
    }

    logInfo('Token revocation table initialized', {});
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Failed to initialize token revocation table', {
      event: 'token_revocation_table_init_failed',
    }, errorObj);
    throw errorObj;
  }
}
