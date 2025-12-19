/**
 * OIDC Authentication Middleware
 * Validates OIDC tokens from Pocket ID
 */

import * as oidc from 'openid-client';
import {UnauthorizedError} from '../utils/errors';

// Type aliases for openid-client types - using eslint-disable for types that aren't properly exported
// The runtime behavior is correct, types are just not properly exported from the library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Issuer = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TokenSet = any;

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
let issuer: Issuer | null = null;
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
let client: Client | null = null;

/**
 * Initialize OIDC client
 */
export async function initializeOIDC(): Promise<void> {
  const discoveryUrl = process.env.OPENID_DISCOVERY_URL;
  const clientId = process.env.OPENID_CLIENT_ID;
  const clientSecret = process.env.OPENID_CLIENT_SECRET;

  if (!discoveryUrl || !clientId || !clientSecret) {
    throw new Error('OIDC configuration missing. Please set OPENID_DISCOVERY_URL, OPENID_CLIENT_ID, and OPENID_CLIENT_SECRET');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  issuer = await (oidc as unknown as {Issuer: {discover: (url: string) => Promise<Issuer>}}).Issuer.discover(discoveryUrl);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  client = new issuer.Client({
    client_id: clientId,
    client_secret: clientSecret,
  });
}

/**
 * Get OIDC client instance
 */
export function getOIDCClient(): Client {
  if (!client) {
    throw new Error('OIDC client not initialized. Call initializeOIDC() first.');
  }
  return client;
}

/**
 * Extract token from Authorization header
 */
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify and decode OIDC token
 * Uses userinfo endpoint which validates the token before returning user data
 * The openid-client library handles token validation automatically
 */
export async function verifyToken(token: string): Promise<TokenSet> {
  if (!client) {
    throw new Error('OIDC client not initialized');
  }

  if (!token || token.trim().length === 0) {
    throw new UnauthorizedError('Token is empty');
  }

  try {
    // The userinfo() method validates the token signature, expiration, and issuer
    // before making the request. If validation fails, it throws an error.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const userInfo = await client.userinfo(token) as {sub?: string; email?: string};
    
    // Additional validation: check if we got a valid subject
    if (!userInfo.sub) {
      throw new UnauthorizedError('Token does not contain a valid subject');
    }

    // Return as TokenSet for compatibility
    return userInfo as unknown as TokenSet;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    // Log the error for debugging but don't expose details to client
    console.error('Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * Get user info from token
 */
export async function getUserFromToken(token: string): Promise<{sub: string; email?: string}> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const tokenSet = await verifyToken(token);
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    sub: (tokenSet.sub as string | undefined) ?? '',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    email: tokenSet.email as string | undefined,
  };
}

/**
 * Authentication middleware factory
 * Returns a function that extracts and validates the token from the request
 */
export function createAuthMiddleware(): (req: {headers: {authorization?: string}}) => Promise<{sub: string; email?: string}> {
  return async (req: {headers: {authorization?: string}}): Promise<{sub: string; email?: string}> => {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      throw new UnauthorizedError('No authorization token provided');
    }

    return getUserFromToken(token);
  };
}


