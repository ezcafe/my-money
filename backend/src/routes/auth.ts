/**
 * Authentication Routes
 * Handles OIDC callback, token refresh, and logout
 * Uses httpOnly cookies for secure token storage
 */

import type {Hono} from 'hono';
import {getCookie, deleteCookie} from 'hono/cookie';
import {getTokenEndpoint} from '../middleware/auth';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  COOKIE_NAMES,
} from '../middleware/cookies';
import {logError} from '../utils/logger';

/**
 * Register authentication routes
 * @param app - Hono app instance
 */
export function registerAuthRoutes(app: Hono): void {
  /**
   * OIDC Callback Endpoint
   * Handles OIDC authorization code callback
   * Exchanges code for tokens and sets httpOnly cookies
   */
  app.get('/auth/callback', async (c) => {
    try {
      const code = c.req.query('code');
      const state = c.req.query('state');

      if (!code) {
        return c.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/auth/callback?error=missing_code`);
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
        return c.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/auth/callback?error=code_verifier_missing`);
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
        return c.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/auth/callback?error=token_endpoint_missing`);
      }
      const tokenResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams,
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text().catch(() => 'Unknown error');
        logError('Token exchange failed', {
          event: 'token_exchange_failed',
          status: tokenResponse.status,
          error: errorText,
        });
        return c.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/auth/callback?error=token_exchange_failed`);
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
      return c.redirect(`${frontendUrl}/auth/callback?success=true${stateParam}`);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError('OIDC callback error', {
        event: 'oidc_callback_error',
      }, errorObj);
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      return c.redirect(`${frontendUrl}/auth/callback?error=callback_failed`);
    }
  });

  /**
   * Token Refresh Endpoint
   * Refreshes access token using refresh token from cookie
   */
  app.post('/auth/refresh', async (c) => {
    try {
      const refreshToken = getCookie(c, COOKIE_NAMES.REFRESH_TOKEN);

      if (!refreshToken) {
        return c.json(
          {
            error: 'No refresh token provided',
            code: 'UNAUTHORIZED',
          },
          401,
        );
      }

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
        return c.json(
          {
            error: 'Token endpoint not found',
            code: 'INTERNAL_SERVER_ERROR',
          },
          500,
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
        // Clear cookies on refresh failure
        clearAuthCookies(c);
        return c.json(
          {
            error: 'Token refresh failed',
            code: 'UNAUTHORIZED',
          },
          401,
        );
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };

      // Update cookies with new tokens
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
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError('Token refresh error', {
        event: 'token_refresh_error',
      }, errorObj);
      clearAuthCookies(c);
      return c.json(
        {
          error: 'Token refresh failed',
          code: 'INTERNAL_SERVER_ERROR',
        },
        500,
      );
    }
  });

  /**
   * Logout Endpoint
   * Clears all authentication cookies
   */
  app.post('/auth/logout', async (c) => {
    try {
      clearAuthCookies(c);
      return c.json({
        success: true,
      });
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError('Logout error', {
        event: 'logout_error',
      }, errorObj);
      // Still clear cookies even on error
      clearAuthCookies(c);
      return c.json({
        success: true,
      });
    }
  });
}
