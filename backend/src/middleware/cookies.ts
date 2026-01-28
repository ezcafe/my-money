/**
 * Cookie Configuration and Utilities
 * Handles httpOnly cookie settings for secure token storage
 */

import type { Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';

/**
 * Cookie security configuration
 * In Docker, we may be using HTTP (not HTTPS), so secure cookies won't work
 * Use COOKIE_SECURE env var to override, or detect HTTPS from request
 */
const isSecureConnection = (): boolean => {
  // Allow environment variable override (explicit control)
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true';
  }
  // If USE_HTTPS is explicitly set, use that
  if (process.env.USE_HTTPS !== undefined) {
    return process.env.USE_HTTPS === 'true';
  }
  // In production without explicit HTTPS setting, default to secure
  // But in Docker with HTTP, this will cause issues, so set USE_HTTPS=false
  return process.env.NODE_ENV === 'production';
};

const getSameSite = (): 'strict' | 'lax' | 'none' => {
  // Allow environment variable override
  if (process.env.COOKIE_SAME_SITE) {
    const value = process.env.COOKIE_SAME_SITE.toLowerCase();
    if (value === 'strict' || value === 'lax' || value === 'none') {
      return value;
    }
  }
  // Use strict only when using HTTPS, otherwise use lax for cross-origin support
  const usingHttps = isSecureConnection();
  return usingHttps ? ('strict' as const) : ('lax' as const);
};

export const COOKIE_CONFIG = {
  httpOnly: true, // Prevents JavaScript access (XSS protection)
  secure: isSecureConnection(), // HTTPS only when actually using HTTPS
  sameSite: getSameSite(), // CSRF protection, lax for Docker HTTP
  path: '/', // Available to all paths
  // maxAge will be set per cookie based on token expiration
};

/**
 * Cookie names
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

/**
 * Set access token cookie
 * @param c - Hono context
 * @param token - Access token
 * @param maxAge - Max age in seconds (default: 1 hour)
 */
export function setAccessTokenCookie(
  c: Context,
  token: string,
  maxAge: number = 3600
): void {
  setCookie(c, COOKIE_NAMES.ACCESS_TOKEN, token, {
    ...COOKIE_CONFIG,
    maxAge, // 1 hour default
  });
}

/**
 * Set refresh token cookie
 * @param c - Hono context
 * @param token - Refresh token
 * @param maxAge - Max age in seconds (default: 7 days)
 */
export function setRefreshTokenCookie(
  c: Context,
  token: string,
  maxAge: number = 604800
): void {
  setCookie(c, COOKIE_NAMES.REFRESH_TOKEN, token, {
    ...COOKIE_CONFIG,
    maxAge, // 7 days default
  });
}

/**
 * Clear access token cookie
 * @param c - Hono context
 */
export function clearAccessTokenCookie(c: Context): void {
  deleteCookie(c, COOKIE_NAMES.ACCESS_TOKEN, {
    path: '/',
  });
}

/**
 * Clear refresh token cookie
 * @param c - Hono context
 */
export function clearRefreshTokenCookie(c: Context): void {
  deleteCookie(c, COOKIE_NAMES.REFRESH_TOKEN, {
    path: '/',
  });
}

/**
 * Clear all auth cookies
 * @param c - Hono context
 */
export function clearAuthCookies(c: Context): void {
  clearAccessTokenCookie(c);
  clearRefreshTokenCookie(c);
}
