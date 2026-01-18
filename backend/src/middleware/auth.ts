/**
 * OIDC Authentication Middleware
 * Validates OIDC tokens from Pocket ID
 */

import * as oidc from 'openid-client';
import {createHash} from 'crypto';
import {UnauthorizedError} from '../utils/errors';
import {logError, logInfo, logWarn} from '../utils/logger';
import {TOKEN_CACHE_TTL_MS} from '../utils/constants';
import {config as appConfig} from '../config';
import * as postgresCache from '../utils/postgresCache';
import {tokenKey} from '../utils/cacheKeys';

// Type aliases for openid-client types
type TokenSet = oidc.UserInfoResponse;

let oidcConfig: oidc.Configuration | null = null;
let tokenEndpointUrl: string | null = null;

/**
 * Hash token for secure caching
 * Uses SHA-256 to create a hash of the token before storing in cache
 * This prevents full tokens from being stored in memory
 * @param token - The OIDC token to hash
 * @returns SHA-256 hash of the token
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest().toString('hex');
}

/**
 * Initialize OIDC client with retry logic
 * Authentication is required - the server will not start without proper OIDC configuration
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelayMs - Delay between retries in milliseconds (default: 2000)
 */
export async function initializeOIDC(maxRetries: number = 3, retryDelayMs: number = 2000): Promise<void> {
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

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // First, try to fetch discovery document directly to verify connectivity
      if (attempt === 1) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
          const discoveryResponse = await fetch(discoveryUrl, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!discoveryResponse.ok) {
            throw new Error(`Discovery endpoint returned ${discoveryResponse.status}: ${discoveryResponse.statusText}`);
          }

          const discoveryDoc = (await discoveryResponse.json()) as {token_endpoint?: string; issuer?: string};
          // Store token endpoint if found
          if (discoveryDoc.token_endpoint) {
            tokenEndpointUrl = discoveryDoc.token_endpoint;
          }
        } catch (fetchError) {
          const fetchErrorObj = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
          logError('Failed to fetch discovery document directly', {
            event: 'oidc_discovery_fetch_failed',
            attempt,
            discoveryUrl,
            error: fetchErrorObj.message,
          }, fetchErrorObj);
          // Continue to try openid-client discovery
        }
      }

      // Use openid-client library for discovery
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
      tokenEndpointUrl = configObj.token_endpoint ?? configObj.metadata?.token_endpoint ?? tokenEndpointUrl ?? null;

      // If still not found, fetch discovery document directly as fallback
      if (!tokenEndpointUrl) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          const discoveryResponse = await fetch(discoveryUrl, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

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

      // Success - break out of retry loop
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isLastAttempt = attempt === maxRetries;

      logError(`Failed to initialize OIDC client (attempt ${attempt}/${maxRetries})`, {
        event: 'oidc_init_failed',
        attempt,
        maxRetries,
        discoveryUrl,
        clientId,
        isLastAttempt,
        error: lastError.message,
        errorType: lastError.constructor.name,
      }, lastError);

      if (isLastAttempt) {
        // Add diagnostic information
        const diagnosticInfo = {
          discoveryUrl,
          error: lastError.message,
          suggestion: 'Check network connectivity, firewall settings, or OIDC provider availability',
        };
        logError('OIDC initialization failed after all retries', {
          event: 'oidc_init_final_failure',
          ...diagnosticInfo,
        }, lastError);
        throw lastError;
      }

      // Wait before retrying (exponential backoff)
      const delay = retryDelayMs * attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  if (lastError) {
    throw lastError;
  }
  throw new Error('OIDC initialization failed for unknown reason');
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
 * Decode JWT token to extract expiration time
 * @param token - JWT token string
 * @returns Expiration time in seconds (Unix timestamp) or null if not found
 */
function getTokenExpiration(token: string): number | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (base64url)
    const payload = parts[1];
    if (!payload) {
      throw new Error('Invalid token format');
    }
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded) as {exp?: number};

    return parsed.exp ?? null;
  } catch {
    // If decoding fails, return null (will rely on OIDC provider validation)
    return null;
  }
}

/**
 * Check if token is expired based on exp claim
 * @param token - JWT token string
 * @returns True if token is expired, false otherwise
 */
function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiration(token);
  if (exp === null) {
    // If we can't determine expiration, let OIDC provider handle it
    return false;
  }

  // exp is in seconds, Date.now() is in milliseconds
  const now = Math.floor(Date.now() / 1000);
  return exp < now;
}

/**
 * Get user info from token
 * Validates OIDC token and returns user information
 * Uses PostgreSQL cache to reduce external OIDC provider calls
 * Tokens are hashed before caching for security
 * Enhanced with token revocation and expiration checks
 */
// Token expiration metrics
let tokenExpirationMetrics = {
  totalChecks: 0,
  expiredCount: 0,
  nearExpirationCount: 0, // Tokens expiring within 5 minutes
};

/**
 * Get token expiration metrics
 * @returns Current token expiration metrics
 */
export function getTokenExpirationMetrics(): typeof tokenExpirationMetrics {
  return {...tokenExpirationMetrics};
}

/**
 * Reset token expiration metrics
 */
export function resetTokenExpirationMetrics(): void {
  tokenExpirationMetrics = {
    totalChecks: 0,
    expiredCount: 0,
    nearExpirationCount: 0,
  };
}

export async function getUserFromToken(token: string): Promise<{sub: string; email?: string}> {
  tokenExpirationMetrics.totalChecks++;

  // Check if token is expired (early validation)
  if (isTokenExpired(token)) {
    tokenExpirationMetrics.expiredCount++;
    logWarn('Token expired', {
      event: 'token_expired',
      totalChecks: tokenExpirationMetrics.totalChecks,
      expiredCount: tokenExpirationMetrics.expiredCount,
    });
    throw new UnauthorizedError('Token has expired');
  }

  // Check if token is near expiration (within 5 minutes)
  // Get token expiration once and reuse it for both checks
  const exp = getTokenExpiration(token);
  if (exp) {
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiration = exp - now;
    const fiveMinutes = 5 * 60;
    if (timeUntilExpiration > 0 && timeUntilExpiration < fiveMinutes) {
      tokenExpirationMetrics.nearExpirationCount++;
      logInfo('Token near expiration', {
        event: 'token_near_expiration',
        secondsUntilExpiration: timeUntilExpiration,
      });
    }
  }

  // NOTE: We do NOT check if access tokens are revoked because:
  // 1. We only revoked refresh tokens (and we've disabled that)
  // 2. The OIDC provider will reject invalid/expired tokens during verification
  // 3. Checking revocation creates race conditions and false positives
  // 4. Access tokens are short-lived and expire naturally
  // If you need to revoke access tokens, do it at the OIDC provider level

  // Hash token for secure caching
  const tokenHash = hashToken(token);
  const cacheKey = tokenKey(tokenHash);

  // Check cache first using hashed token
  const cached = await postgresCache.get<{userInfo: {sub: string; email?: string}}>(cacheKey);
  if (cached) {
    return cached.userInfo;
  }

  // Validate token with OIDC provider
  const tokenSet = await verifyToken(token);
  const userInfo = {
    sub: tokenSet.sub ?? '',
    email: tokenSet.email,
  };

  // Calculate cache TTL based on token expiration
  // Use token expiration if available, otherwise use default TTL
  // Reuse the exp variable declared above
  const cacheTTL = exp
    ? Math.max(0, Math.min(exp * 1000 - Date.now(), TOKEN_CACHE_TTL_MS))
    : TOKEN_CACHE_TTL_MS;

  // Cache the result using hashed token with appropriate TTL
  if (cacheTTL > 0) {
    await postgresCache.set(cacheKey, {userInfo}, cacheTTL).catch(() => {
      // Ignore cache errors - don't break authentication if cache fails
    });
  }

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


