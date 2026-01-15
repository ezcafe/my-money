/**
 * Security Configuration
 * Registers security middleware for Hono server
 */

import type {Hono, Context, Next} from 'hono';
import {cors} from 'hono/cors';
import {compress} from 'hono/compress';
import {randomBytes} from 'crypto';
import {ErrorCode} from '../utils/errorCodes';

/**
 * Rate limiting store (in-memory)
 * In production, consider using Redis for distributed rate limiting
 */
const rateLimitStore = new Map<string, {count: number; resetTime: number}>();

/**
 * Rate limit middleware
 */
function rateLimiter(max: number, windowMs: number): (c: Context, next: Next) => Promise<Response | void> {
  return async (c: Context, next: Next) => {
    const key = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? c.req.header('cf-connecting-ip') ?? 'unknown';
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      // Create new record or reset expired record
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      // Clean up old entries periodically
      if (rateLimitStore.size > 10000) {
        for (const [k, v] of rateLimitStore.entries()) {
          if (now > v.resetTime) {
            rateLimitStore.delete(k);
          }
        }
      }
      return next();
    }

    if (record.count >= max) {
      const ttl = Math.ceil((record.resetTime - now) / 1000);
      return c.json(
        {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          error: 'Too many requests, please try again later',
          message: `Rate limit exceeded, retry in ${ttl} seconds`,
        },
        429,
      );
    }

    record.count += 1;
    return next();
  };
}

/**
 * Security headers middleware
 */
function securityHeaders() {
  return async (c: Context, next: Next): Promise<Response | void> => {
    await next();

    // Generate nonce for CSP
    const nonce = randomBytes(16).toString('base64');
    c.set('nonce', nonce);

    // Build CSP directive
    const cspDirectives = [
      "default-src 'self'",
      process.env.NODE_ENV === 'production'
        ? `style-src 'self' 'nonce-${nonce}'`
        : "style-src 'self' 'unsafe-inline'",
      process.env.NODE_ENV === 'production'
        ? `script-src 'self' 'nonce-${nonce}'`
        : "script-src 'self' 'unsafe-eval'",
      "img-src 'self' data: https:",
      "connect-src 'self' https:",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests' : '',
    ]
      .filter(Boolean)
      .join('; ');

    // Set security headers
    c.header('Content-Security-Policy', cspDirectives);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');

    if (process.env.NODE_ENV === 'production') {
      c.header(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    // Permissions-Policy header
    const permissionsPolicy = [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'battery=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'document-domain=()',
      'encrypted-media=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=()',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'navigation-override=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()',
    ].join(', ');
    c.header('Permissions-Policy', permissionsPolicy);
  };
}

/**
 * CSRF protection middleware for mutations
 */
function csrfProtection() {
  return async (c: Context, next: Next): Promise<Response | void> => {
    // Only check for POST requests (GraphQL mutations)
    if (c.req.method !== 'POST') {
      return next();
    }

    // Try to parse body to check if it's a mutation
    try {
      const body = await c.req.json().catch(() => null) as {query?: string} | null;
      if (body?.query?.includes('mutation')) {
        const origin = c.req.header('Origin');
        const referer = c.req.header('Referer');
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];

        // In production, require Origin or Referer header for mutations
        if (process.env.NODE_ENV === 'production' && allowedOrigins.length > 0) {
          const isValidOrigin =
            (origin !== undefined && allowedOrigins.includes(origin)) ||
            (referer !== undefined && allowedOrigins.some((allowed) => referer.startsWith(allowed)));

          if (!isValidOrigin) {
            return c.json(
              {
                errors: [
                  {
                    message: 'CSRF validation failed',
                    extensions: {
                      code: ErrorCode.FORBIDDEN,
                      statusCode: 403,
                    },
                  },
                ],
              },
              403,
            );
          }
        }
      }
    } catch {
      // If body parsing fails, continue (might be multipart)
    }

    return next();
  };
}

/**
 * Register security middleware
 * @param app - Hono app instance
 */
export function registerSecurityPlugins(app: Hono): void {
  // Cookie support is handled via getCookie/setCookie helpers from 'hono/cookie'
  // No middleware registration needed

  // Enable compression
  app.use(compress());

  // CORS configuration - allow frontend to communicate with backend
  // Configured via CORS_ORIGIN environment variable (comma-separated list of allowed origins)
  // Defaults to localhost:3000 for development
  // Example: CORS_ORIGIN=http://localhost:3000,https://example.com
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.use(
    cors({
      origin: corsOrigins,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true, // Required for cookies
      exposeHeaders: ['Content-Type'],
    }),
  );

  // Security headers middleware
  app.use(securityHeaders());

  // Rate limiting - general limit (100 requests per minute)
  app.use(rateLimiter(100, 60 * 1000));

  // CSRF protection for mutations
  app.use(csrfProtection());
}
