/**
 * Security Configuration
 * Registers security middleware for Hono server
 */

import type {Hono, Context, Next} from 'hono';
import {cors} from 'hono/cors';
import {compress} from 'hono/compress';
import {randomBytes} from 'crypto';
import {ErrorCode} from '../utils/errorCodes';
import {checkRateLimit} from '../utils/postgresRateLimiter';
import {RATE_LIMITS} from '../utils/constants';

/**
 * Rate limit middleware
 * Uses PostgreSQL for distributed rate limiting across server instances
 * Supports both IP-based and user-based rate limiting
 */
function rateLimiter(max: number, windowMs: number): (c: Context, next: Next) => Promise<Response | void> {
  return async (c: Context, next: Next) => {
    // Try to get user ID from context (if authenticated)
    // This allows user-based rate limiting for authenticated requests
    const userId = c.get('userId') as string | undefined;
    const key = userId
      ? `user:${userId}`
      : c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? c.req.header('cf-connecting-ip') ?? 'unknown';

    try {
      const result = await checkRateLimit(key, max, windowMs);

      if (!result.allowed) {
        const ttl = Math.ceil((result.resetAt - Date.now()) / 1000);
        return c.json(
          {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            error: 'Too many requests, please try again later',
            message: `Rate limit exceeded, retry in ${ttl} seconds`,
          },
          429,
        );
      }

      // Add rate limit headers for client information
      c.header('X-RateLimit-Limit', String(max));
      c.header('X-RateLimit-Remaining', String(result.remaining));
      c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

      return next();
    } catch {
      // On error, allow the request (fail open)
      // This prevents rate limiter failures from breaking the application
      return next();
    }
  };
}

/**
 * Security headers middleware
 * Generates CSP nonce BEFORE processing the request so it's available for the response
 */
function securityHeaders() {
  return async (c: Context, next: Next): Promise<Response | void> => {
    // Generate nonce for CSP BEFORE processing the request
    // This ensures the nonce is available for the response headers
    const nonce = randomBytes(16).toString('base64');
    c.set('nonce', nonce);

    // Build CSP directive with nonce
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

    // Process the request
    await next();

    // Set security headers AFTER processing (so they're in the response)
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
  // Note: Hono's compress middleware supports gzip and deflate
  // Brotli compression is handled by nginx in production (see docker/nginx.conf)
  // The compress() middleware automatically:
  // - Detects Accept-Encoding header
  // - Compresses responses for text-based content types
  // - Sets appropriate Content-Encoding header
  app.use(compress());

  // CORS configuration - allow frontend to communicate with backend
  // Configured via CORS_ORIGIN environment variable (comma-separated list of allowed origins)
  // Defaults to localhost:3000 for development
  // Example: CORS_ORIGIN=http://localhost:3000,https://example.com
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  // In production, validate origins more strictly
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = isProduction ? 86400 : 3600; // 24 hours in production, 1 hour in development

  app.use(
    cors({
      origin: (origin: string | null): string => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          // In production, be more restrictive
          if (isProduction) {
            throw new Error('Origin header required in production');
          }
          return '*';
        }

        // Check if origin is in allowed list
        if (corsOrigins.includes(origin)) {
          return origin;
        }

        // In production, reject unknown origins
        if (isProduction) {
          throw new Error(`Origin ${origin} not allowed by CORS policy`);
        }

        // In development, allow localhost origins even if not explicitly listed
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return origin;
        }

        throw new Error(`Origin ${origin} not allowed by CORS policy`);
      },
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
      credentials: true, // Required for cookies
      exposeHeaders: ['Content-Type', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      maxAge, // Cache preflight requests
    }),
  );

  // Security headers middleware
  app.use(securityHeaders());

  // Rate limiting - general IP-based limit
  // User-based rate limiting with granular limits is applied in GraphQL handler after authentication
  app.use(rateLimiter(RATE_LIMITS.GENERAL_IP, RATE_LIMITS.WINDOW_MS));

  // CSRF protection for mutations
  app.use(csrfProtection());
}
