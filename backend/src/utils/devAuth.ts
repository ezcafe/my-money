/**
 * Dev Authentication Utility
 * Handles JWT token generation and verification for development login
 */

import jwt from 'jsonwebtoken';

// Dev token prefix to identify dev tokens
const DEV_TOKEN_PREFIX = 'dev:';

// Get or generate secret key for signing JWT tokens
function getSecretKey(): string {
  const envSecret = process.env.DEV_AUTH_SECRET;
  if (envSecret) {
    return envSecret;
  }

  // Use a fixed development secret if not provided (for development only)
  // This ensures tokens remain valid across server restarts
  // In production, this should always be set via env variable
  const fixedDevSecret = 'dev-secret-key-for-jwt-signing-do-not-use-in-production';
  console.warn('⚠️  DEV_AUTH_SECRET not set. Using fixed development secret (not recommended for production)');
  console.warn('⚠️  Set DEV_AUTH_SECRET in your .env file for production use');
  return fixedDevSecret;
}

const SECRET_KEY = getSecretKey();

/**
 * Interface for dev token payload
 */
interface DevTokenPayload {
  sub: string;
  email: string;
  type: 'dev';
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for dev user
 * @param username - Username for the dev user
 * @param email - Email for the dev user
 * @returns JWT token string with dev prefix
 */
export function generateDevToken(username: string, email: string): string {
  const payload: DevTokenPayload = {
    sub: `dev:${username}`,
    email,
    type: 'dev',
  };

  // Token expires in 24 hours
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const token = jwt.sign(payload, SECRET_KEY, {
    expiresIn: '24h',
  });

  // Prefix with dev: to identify dev tokens
  return `${DEV_TOKEN_PREFIX}${token}`;
}

/**
 * Check if a token is a dev token
 * @param token - Token string to check
 * @returns True if token is a dev token
 */
export function isDevToken(token: string): boolean {
  return token.startsWith(DEV_TOKEN_PREFIX);
}

/**
 * Verify and decode a dev token
 * @param token - Dev token string (with or without prefix)
 * @returns Decoded token payload
 * @throws Error if token is invalid or expired
 */
export function verifyDevToken(token: string): DevTokenPayload {
  // Remove prefix if present
  const tokenWithoutPrefix = token.startsWith(DEV_TOKEN_PREFIX)
    ? token.slice(DEV_TOKEN_PREFIX.length)
    : token;

  try {
    const decoded = jwt.verify(tokenWithoutPrefix, SECRET_KEY) as DevTokenPayload;

    // Verify it's a dev token
    if (decoded.type !== 'dev') {
      throw new Error('Token is not a dev token');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Dev token has expired. Please log in again.');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      // Provide more specific error message
      const errorMessage = error.message || 'Invalid dev token';
      if (errorMessage.includes('invalid signature')) {
        throw new Error('Invalid dev token signature. The token may have been signed with a different secret key. Please log in again.');
      }
      if (errorMessage.includes('jwt malformed')) {
        throw new Error('Invalid dev token format. Please log in again.');
      }
      throw new Error(`Invalid dev token: ${errorMessage}`);
    }
    // Re-throw with more context
    throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract user info from dev token
 * @param token - Dev token string
 * @returns User info with sub and email
 */
export function getUserFromDevToken(token: string): {sub: string; email: string} {
  const decoded = verifyDevToken(token);
  return {
    sub: decoded.sub,
    email: decoded.email,
  };
}

