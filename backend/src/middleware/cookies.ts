/**
 * Cookie Configuration and Utilities
 * Handles httpOnly cookie settings for secure token storage
 */

import type {Context} from 'hono';
import {setCookie, deleteCookie} from 'hono/cookie';

/**
 * Cookie security configuration
 */
export const COOKIE_CONFIG = {
  httpOnly: true, // Prevents JavaScript access (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: process.env.NODE_ENV === 'production' ? ('strict' as const) : ('lax' as const), // CSRF protection
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
export function setAccessTokenCookie(c: Context, token: string, maxAge: number = 3600): void {
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
export function setRefreshTokenCookie(c: Context, token: string, maxAge: number = 604800): void {
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
