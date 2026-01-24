/**
 * Rate Limiting Security Tests
 * Tests PostgreSQL-based rate limiting
 * Note: Requires a test database connection
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Hono } from 'hono';
import {
  checkRateLimit,
  clearExpired,
} from '../../src/utils/postgresRateLimiter';
import type { Context, Next } from 'hono';
import { ErrorCode } from '../../src/utils/errorCodes';

/**
 * Rate limit middleware using PostgreSQL rate limiter
 */
function rateLimiter(max: number, windowMs: number) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const key =
      c.req.header('x-forwarded-for') ??
      c.req.header('x-real-ip') ??
      'test-client';

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
          429
        );
      }

      return next();
    } catch (error) {
      // On error, allow the request (fail open)
      return next();
    }
  };
}

describe('Rate Limiting', () => {
  let app: Hono;
  const testKey = 'test-client-' + Date.now();

  beforeEach(async () => {
    app = new Hono();
    // Clear any existing rate limit entries for test key
    await clearExpired();
    app.use(rateLimiter(5, 60 * 1000)); // 5 requests per minute for testing

    app.get('/test', async (c) => {
      return c.json({ message: 'ok' });
    });
  });

  afterEach(async () => {
    // Clean up test data
    await clearExpired();
  });

  it('should allow requests within limit', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await app.request('/test', {
        method: 'GET',
        headers: {
          'x-forwarded-for': testKey,
        },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ message: 'ok' });
    }
  }, 10000); // Increase timeout for database operations

  it('should reject requests exceeding limit', async () => {
    // Make 5 requests (within limit)
    for (let i = 0; i < 5; i++) {
      const response = await app.request('/test', {
        method: 'GET',
        headers: {
          'x-forwarded-for': testKey + '-limit',
        },
      });
      expect(response.status).toBe(200);
    }

    // 6th request should be rate limited
    const response = await app.request('/test', {
      method: 'GET',
      headers: {
        'x-forwarded-for': testKey + '-limit',
      },
    });
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
  }, 10000); // Increase timeout for database operations
});
