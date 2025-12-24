/**
 * OIDC Authentication Middleware
 * Validates OIDC tokens from Pocket ID
 */

import * as oidc from 'openid-client';
import {UnauthorizedError} from '../utils/errors';

// Type aliases for openid-client types
type TokenSet = oidc.UserInfoResponse;

let config: oidc.Configuration | null = null;

/**
 * Initialize OIDC client
 * Authentication is required - the server will not start without proper OIDC configuration
 */
export async function initializeOIDC(): Promise<void> {
  const discoveryUrl = process.env.OPENID_DISCOVERY_URL;
  const clientId = process.env.OPENID_CLIENT_ID;
  const clientSecret = process.env.OPENID_CLIENT_SECRET;

  if (!discoveryUrl || !clientId || !clientSecret) {
    const missingVars: string[] = [];
    if (!discoveryUrl) missingVars.push('OPENID_DISCOVERY_URL');
    if (!clientId) missingVars.push('OPENID_CLIENT_ID');
    if (!clientSecret) missingVars.push('OPENID_CLIENT_SECRET');

    console.error('❌ OIDC configuration missing. Authentication is required.');
    console.error('');
    console.error('   Please update your .env file with the following variables:');
    console.error('');
    missingVars.forEach((varName) => {
      console.error(`   ${varName}=<your-value>`);
    });
    console.error('');
    console.error('   Example .env configuration:');
    console.error('   OPENID_DISCOVERY_URL=https://your-oidc-provider/.well-known/openid-configuration');
    console.error('   OPENID_CLIENT_ID=your-client-id');
    console.error('   OPENID_CLIENT_SECRET=your-client-secret');
    console.error('');

    throw new Error(`OIDC configuration missing: ${missingVars.join(', ')}. Please update your .env file.`);
  }

  try {
    const url = new URL(discoveryUrl);
    config = await oidc.discovery(
      url,
      clientId,
      clientSecret,
      oidc.ClientSecretPost(clientSecret)
    );
  } catch (error) {
    console.error('❌ Failed to initialize OIDC client:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Get OIDC configuration instance
 */
export function getOIDCConfig(): oidc.Configuration {
  if (!config) {
    throw new Error('OIDC client not initialized. Call initializeOIDC() first.');
  }
  return config;
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
  if (!config) {
    throw new Error('OIDC client not initialized. Call initializeOIDC() first.');
  }

  if (!token || token.trim().length === 0) {
    throw new UnauthorizedError('Token is empty');
  }

  try {
    // The fetchUserInfo() function validates the token and returns user data
    const userInfo = await oidc.fetchUserInfo(config, token, oidc.skipSubjectCheck);
    
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


