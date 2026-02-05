/**
 * Authentication Routes
 * Handles OIDC callback, token refresh, and logout
 * Uses httpOnly cookies for secure token storage
 */

import type { Hono, Context, Next } from 'hono';
import { getCookie, deleteCookie } from 'hono/cookie';
import { getTokenEndpoint } from '../middleware/auth';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  COOKIE_NAMES,
} from '../middleware/cookies';
import { logError } from '../utils/logger';
import {
  checkRateLimit,
  isLockedOut,
  setLockout,
  getLockoutResetTime,
} from '../utils/postgresRateLimiter';
import { ErrorCode } from '../utils/errorCodes';
import { RATE_LIMITS } from '../utils/constants';

/**
 * Map to track ongoing refresh token operations by refresh token hash
 * Prevents concurrent refresh calls with the same token
 */
const ongoingRefreshOperations = new Map<
  string,
  Promise<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  }>
>();

/**
 * Map to track tokens that are scheduled for revocation
 * Key: token hash, Value: timestamp when revocation was scheduled
 * This prevents revoking tokens that are still being used by concurrent requests
 * Note: Currently unused but kept for future rate limiting needs
 */
// const scheduledRevocations = new Map<string, number>();

/**
 * Get client IP for rate limiting and lockout (same derivation for all auth keys).
 */
function getClientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for') ??
    c.req.header('x-real-ip') ??
    c.req.header('cf-connecting-ip') ??
    'unknown'
  );
}

/**
 * Rate limiter for login (GET /auth/callback). Stricter limit per IP. Fail-closed on error.
 */
function createAuthLoginRateLimiter() {
  const max = RATE_LIMITS.AUTH_LOGIN;
  const windowMs = RATE_LIMITS.AUTH_WINDOW_MS;
  return async (c: Context, next: Next): Promise<Response | void> => {
    const ip = getClientIp(c);
    const key = `auth_login:${ip}`;
    try {
      const result = await checkRateLimit(key, max, windowMs);
      if (!result.allowed) {
        const ttl = Math.ceil((result.resetAt - Date.now()) / 1000);
        c.header('Retry-After', String(ttl));
        return c.json(
          {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            error: 'Too many login attempts, please try again later',
            message: `Login rate limit exceeded, retry in ${ttl} seconds`,
          },
          429
        );
      }
      c.header('X-RateLimit-Limit', String(max));
      c.header('X-RateLimit-Remaining', String(result.remaining));
      c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
      return next();
    } catch {
      c.header('Retry-After', '60');
      return c.json(
        {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          error: 'Authentication service temporarily unavailable',
          message: 'Please try again later',
        },
        503
      );
    }
  };
}

/**
 * Rate limiter for refresh and logout (POST /auth/refresh, POST /auth/logout). More lenient. Fail-closed on error.
 */
function createAuthRefreshRateLimiter() {
  const max = RATE_LIMITS.AUTH_REFRESH;
  const windowMs = RATE_LIMITS.AUTH_WINDOW_MS;
  return async (c: Context, next: Next): Promise<Response | void> => {
    const ip = getClientIp(c);
    const key = `auth_refresh:${ip}`;
    try {
      const result = await checkRateLimit(key, max, windowMs);
      if (!result.allowed) {
        const ttl = Math.ceil((result.resetAt - Date.now()) / 1000);
        c.header('Retry-After', String(ttl));
        return c.json(
          {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            error: 'Too many authentication requests, please try again later',
            message: `Authentication rate limit exceeded, retry in ${ttl} seconds`,
          },
          429
        );
      }
      c.header('X-RateLimit-Limit', String(max));
      c.header('X-RateLimit-Remaining', String(result.remaining));
      c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
      return next();
    } catch {
      c.header('Retry-After', '60');
      return c.json(
        {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          error: 'Authentication service temporarily unavailable',
          message: 'Please try again later',
        },
        503
      );
    }
  };
}

/**
 * Record a failed login attempt for the client IP and set lockout if threshold reached.
 * Call only when redirecting with an error (e.g. missing_code, token_exchange_failed).
 */
async function recordFailedLoginAttempt(c: Context): Promise<void> {
  const ip = getClientIp(c);
  const failedKey = `auth_failed:${ip}`;
  const lockoutKey = `auth_lockout:${ip}`;
  const max = RATE_LIMITS.AUTH_FAILED_MAX;
  const windowMs = RATE_LIMITS.AUTH_FAILED_WINDOW_MS;
  try {
    const result = await checkRateLimit(failedKey, max, windowMs);
    if (result.remaining === 0) {
      await setLockout(lockoutKey, Date.now() + RATE_LIMITS.AUTH_LOCKOUT_MS);
    }
  } catch {
    // Best effort; do not block the error redirect
  }
}

/**
 * Register authentication routes
 * @param app - Hono app instance
 */
export function registerAuthRoutes(app: Hono): void {
  /**
   * OIDC Callback Endpoint
   * Handles OIDC authorization code callback
   * Exchanges code for tokens and sets httpOnly cookies
   * Rate limited per IP (login limit); lockout checked inside handler.
   */
  app.get('/auth/callback', createAuthLoginRateLimiter(), async (c) => {
    try {
      const ip = getClientIp(c);
      const lockoutKey = `auth_lockout:${ip}`;
      if (await isLockedOut(lockoutKey)) {
        const resetAt = await getLockoutResetTime(lockoutKey);
        const ttl = resetAt ? Math.ceil((resetAt - Date.now()) / 1000) : 60;
        c.header('Retry-After', String(ttl));
        return c.json(
          {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            error: 'Too many failed login attempts, try again later',
            message: `Account temporarily locked, retry in ${ttl} seconds`,
          },
          429
        );
      }

      const code = c.req.query('code');
      const state = c.req.query('state');

      if (!code) {
        await recordFailedLoginAttempt(c);
        return c.redirect(
          `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/auth/callback?error=missing_code`
        );
      }

      const clientId = process.env.OPENID_CLIENT_ID ?? '';
      const clientSecret = process.env.OPENID_CLIENT_SECRET ?? '';
      const redirectUri = `${process.env.BACKEND_URL ?? 'http://localhost:4000'}/auth/callback`;

      // Get code verifier from cookie (set by frontend during login initiation)
      const codeVerifier = getCookie(c, 'oidc_verifier');
      if (!codeVerifier) {
        logError('Code verifier not found in cookies', {
          event: 'code_verifier_missing',
        });
        await recordFailedLoginAttempt(c);
        return c.redirect(
          `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/auth/callback?error=code_verifier_missing`
        );
      }

      // Exchange authorization code for tokens
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      });

      // Add client_secret if provided (required by confidential clients)
      if (clientSecret) {
        tokenParams.append('client_secret', clientSecret);
      }

      // Clear the temporary verifier cookie after use
      deleteCookie(c, 'oidc_verifier', {
        path: '/',
      });

      // Exchange code for tokens
      let tokenEndpoint: string;
      try {
        tokenEndpoint = getTokenEndpoint();
      } catch {
        logError('Token endpoint not found in OIDC configuration', {
          event: 'token_endpoint_missing',
        });
        await recordFailedLoginAttempt(c);
        return c.redirect(
          `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/auth/callback?error=token_endpoint_missing`
        );
      }
      const tokenResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams,
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse
          .text()
          .catch(() => 'Unknown error');
        logError('Token exchange failed', {
          event: 'token_exchange_failed',
          status: tokenResponse.status,
          error: errorText,
        });
        await recordFailedLoginAttempt(c);
        return c.redirect(
          `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/auth/callback?error=token_exchange_failed`
        );
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };

      // Set httpOnly cookies with tokens
      if (tokenData.access_token) {
        const expiresIn = tokenData.expires_in ?? 3600; // Default to 1 hour
        setAccessTokenCookie(c, tokenData.access_token, expiresIn);
      }

      if (tokenData.refresh_token) {
        const refreshExpiresIn = 604800; // 7 days default
        setRefreshTokenCookie(c, tokenData.refresh_token, refreshExpiresIn);
      }

      // Redirect to frontend with success and state for validation
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
      return c.redirect(
        `${frontendUrl}/auth/callback?success=true${stateParam}`
      );
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logError(
        'OIDC callback error',
        {
          event: 'oidc_callback_error',
        },
        errorObj
      );
      await recordFailedLoginAttempt(c);
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      return c.redirect(`${frontendUrl}/auth/callback?error=callback_failed`);
    }
  });

  /**
   * Token Refresh Endpoint
   * Refreshes access token using refresh token from cookie
   * Uses a lock mechanism to prevent concurrent refresh calls with the same token
   */
  app.post('/auth/refresh', createAuthRefreshRateLimiter(), async (c) => {
    try {
      const refreshToken = getCookie(c, COOKIE_NAMES.REFRESH_TOKEN);

      if (!refreshToken) {
        return c.json(
          {
            error: 'No refresh token provided',
            code: 'UNAUTHORIZED',
          },
          401
        );
      }

      // Create a hash of the refresh token to use as a key for the lock
      // This prevents concurrent refresh calls with the same token
      const crypto = await import('crypto');
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex')
        .substring(0, 16);

      // Check if there's already an ongoing refresh operation for this token
      const existingOperation = ongoingRefreshOperations.get(tokenHash);
      if (existingOperation) {
        // Wait for the existing operation to complete and return its result
        try {
          const tokenData = await existingOperation;
          // Set cookies with the result from the existing operation
          if (tokenData.access_token) {
            const expiresIn = tokenData.expires_in ?? 3600;
            setAccessTokenCookie(c, tokenData.access_token, expiresIn);
          }
          if (tokenData.refresh_token) {
            const refreshExpiresIn = 604800;
            setRefreshTokenCookie(c, tokenData.refresh_token, refreshExpiresIn);
          }
          return c.json({
            success: true,
          });
        } catch {
          // If the existing operation failed, continue with a new one
          ongoingRefreshOperations.delete(tokenHash);
        }
      }

      // Create a new refresh operation promise
      const refreshOperation = (async (): Promise<{
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      }> => {
        const clientId = process.env.OPENID_CLIENT_ID ?? '';
        const clientSecret = process.env.OPENID_CLIENT_SECRET ?? '';
        const redirectUri = `${process.env.BACKEND_URL ?? 'http://localhost:4000'}/auth/callback`;

        // Exchange refresh token for new access token
        const tokenParams = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          redirect_uri: redirectUri,
        });

        if (clientSecret) {
          tokenParams.append('client_secret', clientSecret);
        }

        let tokenEndpoint: string;
        try {
          tokenEndpoint = getTokenEndpoint();
        } catch {
          logError('Token endpoint not found in OIDC configuration', {
            event: 'token_endpoint_missing',
          });
          throw new Error('Token endpoint not found');
        }
        const tokenResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenParams,
        });

        if (!tokenResponse.ok) {
          // Read response status for error details
          const responseStatus = tokenResponse.status;
          await tokenResponse.text().catch(() => {
            // Consume response body
            return 'Unable to read response';
          });
          throw new Error(`Token refresh failed: ${responseStatus}`);
        }

        const tokenData = (await tokenResponse.json()) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };

        return tokenData;
      })();

      // Store the operation in the map to prevent concurrent calls
      ongoingRefreshOperations.set(tokenHash, refreshOperation);

      // Wait for the operation to complete
      let tokenData: {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };
      try {
        tokenData = await refreshOperation;
      } catch {
        // Remove from map on error
        ongoingRefreshOperations.delete(tokenHash);
        // Clear cookies on refresh failure
        clearAuthCookies(c);
        return c.json(
          {
            error: 'Token refresh failed',
            code: 'UNAUTHORIZED',
          },
          401
        );
      } finally {
        // Always remove from map after completion (success or failure)
        // Use a small delay to allow any concurrent requests to see the result
        setTimeout(() => {
          ongoingRefreshOperations.delete(tokenHash);
        }, 1000);
      }

      // Token rotation: Most OIDC providers automatically invalidate old refresh tokens
      // when new ones are issued, so we don't need to revoke them ourselves.
      // Revoking tokens ourselves creates race conditions with concurrent requests.
      // If token revocation is needed for security, it should be handled by the OIDC provider.

      // Update cookies with new tokens
      if (tokenData.access_token) {
        const expiresIn = tokenData.expires_in ?? 3600;
        setAccessTokenCookie(c, tokenData.access_token, expiresIn);
      }

      if (tokenData.refresh_token) {
        const refreshExpiresIn = 604800;
        setRefreshTokenCookie(c, tokenData.refresh_token, refreshExpiresIn);
      }

      // NOTE: We do NOT revoke old refresh tokens here because:
      // 1. Most OIDC providers automatically invalidate old tokens when new ones are issued
      // 2. Revoking tokens ourselves creates race conditions with concurrent requests
      // 3. The OIDC provider will reject old tokens if they're no longer valid
      // If you need explicit token revocation for security, configure it in your OIDC provider

      // Cookies are already set above before token rotation logic
      return c.json({
        success: true,
      });
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      logError(
        'Token refresh error',
        {
          event: 'token_refresh_error',
        },
        errorObj
      );
      clearAuthCookies(c);
      return c.json(
        {
          error: 'Token refresh failed',
          code: 'INTERNAL_SERVER_ERROR',
        },
        500
      );
    }
  });

  /**
   * Logout Endpoint
   * Clears all authentication cookies
   */
  app.post('/auth/logout', createAuthRefreshRateLimiter(), (c) => {
    try {
      clearAuthCookies(c);
      return c.json({
        success: true,
      });
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      logError(
        'Logout error',
        {
          event: 'logout_error',
        },
        errorObj
      );
      // Still clear cookies even on error
      clearAuthCookies(c);
      return c.json({
        success: true,
      });
    }
  });
}
