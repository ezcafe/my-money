/**
 * OIDC Authentication Middleware
 * Validates OIDC tokens from Pocket ID
 */

import * as oidc from 'openid-client';
import {LRUCache} from 'lru-cache';
import {createHash} from 'crypto';
import {UnauthorizedError} from '../utils/errors';
import {logError} from '../utils/logger';
import {TOKEN_CACHE_TTL_MS, DATALOADER_CACHE_SIZE_LIMIT} from '../utils/constants';
import {config as appConfig} from '../config';

// Type aliases for openid-client types
type TokenSet = oidc.UserInfoResponse;

let oidcConfig: oidc.Configuration | null = null;
let tokenEndpointUrl: string | null = null;

/**
 * Token cache entry
 */
interface TokenCacheEntry {
  userInfo: {sub: string; email?: string};
}

/**
 * Hash token for secure caching
 * Uses SHA-256 to create a hash of the token before storing in cache
 * This prevents full tokens from being stored in memory
 * @param token - The OIDC token to hash
 * @returns SHA-256 hash of the token
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * LRU token cache with TTL and size limit
 * Cache tokens for 5 minutes to reduce external OIDC provider calls
 * Maximum 1000 entries to prevent memory leaks
 * Uses hashed tokens as keys for security
 */
const tokenCache = new LRUCache<string, TokenCacheEntry>({
  max: DATALOADER_CACHE_SIZE_LIMIT, // Maximum number of entries
  ttl: TOKEN_CACHE_TTL_MS, // Time to live in milliseconds
});

/**
 * Initialize OIDC client
 * Authentication is required - the server will not start without proper OIDC configuration
 */
export async function initializeOIDC(): Promise<void> {
  const {discoveryUrl, clientId, clientSecret} = appConfig.oidc;

  if (!discoveryUrl || !clientId || !clientSecret) {
    const missingVars: string[] = [];
    if (!discoveryUrl) missingVars.push('OPENID_DISCOVERY_URL');
    if (!clientId) missingVars.push('OPENID_CLIENT_ID');
    if (!clientSecret) missingVars.push('OPENID_CLIENT_SECRET');

    const errorMessage = `OIDC configuration missing: ${missingVars.join(', ')}. Please update your .env file.`;
    logError('OIDC configuration missing. Authentication is required.', {
      event: 'oidc_config_missing',
      missingVars: missingVars.join(', '),
      message: 'Please update your .env file with the following variables:',
      exampleUrl: 'https://your-oidc-provider/.well-known/openid-configuration',
      exampleClientId: 'your-client-id',
      exampleClientSecret: 'your-client-secret',
    }, new Error(errorMessage));

    throw new Error(errorMessage);
  }

  try {
    const url = new URL(discoveryUrl);
    oidcConfig = await oidc.discovery(
      url,
      clientId,
      clientSecret,
      oidc.ClientSecretPost(clientSecret)
    );

    // Extract token_endpoint from Configuration object
    // The Configuration type may not expose token_endpoint directly, so we access it via the object
    const configObj = oidcConfig as unknown as {token_endpoint?: string; metadata?: {token_endpoint?: string}};
    tokenEndpointUrl = configObj.token_endpoint ?? configObj.metadata?.token_endpoint ?? null;

    // If still not found, fetch discovery document directly
    if (!tokenEndpointUrl) {
      try {
        const discoveryResponse = await fetch(discoveryUrl);
        if (discoveryResponse.ok) {
          const discoveryDoc = (await discoveryResponse.json()) as {token_endpoint?: string};
          tokenEndpointUrl = discoveryDoc.token_endpoint ?? null;
        }
      } catch {
        // Ignore fetch errors, will throw below if tokenEndpointUrl is still null
      }
    }

    if (!tokenEndpointUrl) {
      throw new Error('Token endpoint not found in OIDC configuration');
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Failed to initialize OIDC client', {
      event: 'oidc_init_failed',
      discoveryUrl,
      clientId,
    }, errorObj);
    throw error;
  }
}

/**
 * Get OIDC configuration instance
 */
export function getOIDCConfig(): oidc.Configuration {
  if (!oidcConfig) {
    throw new Error('OIDC client not initialized. Call initializeOIDC() first.');
  }
  return oidcConfig;
}

/**
 * Get token endpoint URL
 * @returns Token endpoint URL for OIDC token exchange
 */
export function getTokenEndpoint(): string {
  if (!tokenEndpointUrl) {
    throw new Error('Token endpoint not available. OIDC client may not be initialized.');
  }
  return tokenEndpointUrl;
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

  return parts[1] ?? null;
}

/**
 * Verify and decode OIDC token
 * Uses userinfo endpoint which validates the token before returning user data
 * The openid-client library handles token validation automatically
 */
export async function verifyToken(token: string): Promise<TokenSet> {
  if (!oidcConfig) {
    throw new Error('OIDC client not initialized. Call initializeOIDC() first.');
  }

  if (!token || token.trim().length === 0) {
    throw new UnauthorizedError('Token is empty');
  }

  try {
    // The fetchUserInfo() function validates the token and returns user data
    const userInfo = await oidc.fetchUserInfo(oidcConfig, token, oidc.skipSubjectCheck);

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
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Token verification failed', {
      event: 'token_verification_failed',
    }, errorObj);
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * Get user info from token
 * Validates OIDC token and returns user information
 * Uses caching to reduce external OIDC provider calls
 * Tokens are hashed before caching for security
 */
export async function getUserFromToken(token: string): Promise<{sub: string; email?: string}> {
  // Hash token for secure caching
  const tokenHash = hashToken(token);

  // Check cache first using hashed token
  const cached = tokenCache.get(tokenHash);
  if (cached) {
    return cached.userInfo;
  }

  // Validate token with OIDC provider
  const tokenSet = await verifyToken(token);
  const userInfo = {
    sub: tokenSet.sub ?? '',
    email: tokenSet.email,
  };

  // Cache the result using hashed token (LRU cache handles TTL automatically)
  tokenCache.set(tokenHash, {
    userInfo,
  });

  return userInfo;
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


