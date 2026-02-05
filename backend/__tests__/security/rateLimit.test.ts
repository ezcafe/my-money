/**
 * Rate Limiting Security Tests
 * Tests PostgreSQL-based rate limiting
 * Note: Requires a test database connection
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { Hono } from 'hono';
import {
  checkRateLimit,
  clearExpired,
  isLockedOut,
  setLockout,
  getLockoutResetTime,
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
    } catch {
      // On error, allow the request (fail open)
      return next();
    }
  };
}

describe('Rate Limiting', () => {
  let app: Hono;
  const testKey = `test-client-${Date.now()}`;

  beforeEach(async () => {
    app = new Hono();
    // Clear any existing rate limit entries for test key
    await clearExpired();
    app.use(rateLimiter(5, 60 * 1000)); // 5 requests per minute for testing

    app.get('/test', (c) => {
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
          'x-forwarded-for': `${testKey}-limit`,
        },
      });
      expect(response.status).toBe(200);
    }

    // 6th request should be rate limited
    const response = await app.request('/test', {
      method: 'GET',
      headers: {
        'x-forwarded-for': `${testKey}-limit`,
      },
    });
    expect(response.status).toBe(429);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
  }, 10000); // Increase timeout for database operations
});

describe('Auth rate limiting', () => {
  const unique = Date.now();

  afterEach(async () => {
    await clearExpired();
  });

  it('uses separate keys for login vs refresh (different buckets)', async () => {
    const loginKey = `auth_login:ip-${unique}`;
    const refreshKey = `auth_refresh:ip-${unique}`;
    const windowMs = 60 * 1000;
    const loginMax = 3;
    const refreshMax = 10;

    for (let i = 0; i < loginMax; i++) {
      const r = await checkRateLimit(loginKey, loginMax, windowMs);
      expect(r.allowed).toBe(true);
    }
    const overLogin = await checkRateLimit(loginKey, loginMax, windowMs);
    expect(overLogin.allowed).toBe(false);

    for (let i = 0; i < refreshMax; i++) {
      const r = await checkRateLimit(refreshKey, refreshMax, windowMs);
      expect(r.allowed).toBe(true);
    }
    const overRefresh = await checkRateLimit(refreshKey, refreshMax, windowMs);
    expect(overRefresh.allowed).toBe(false);
  }, 15000);

  it('lockout: setLockout then isLockedOut returns true and getLockoutResetTime returns future', async () => {
    const key = `auth_lockout:ip-${unique}`;
    const lockoutEndMs = Date.now() + 15 * 60 * 1000;
    await setLockout(key, lockoutEndMs);
    const locked = await isLockedOut(key);
    expect(locked).toBe(true);
    const resetAt = await getLockoutResetTime(key);
    expect(resetAt).not.toBeNull();
    expect((resetAt as number) > Date.now()).toBe(true);
  }, 10000);

  it('lockout: expired or missing key returns false', async () => {
    const missingKey = `auth_lockout:nonexistent-${unique}`;
    const missingLocked = await isLockedOut(missingKey);
    expect(missingLocked).toBe(false);
    const pastKey = `auth_lockout:past-${unique}`;
    await setLockout(pastKey, Date.now() - 1000);
    const pastLocked = await isLockedOut(pastKey);
    expect(pastLocked).toBe(false);
  }, 10000);

  it('failed attempts: after N increments on auth_failed key, remaining is 0', async () => {
    const key = `auth_failed:ip-${unique}`;
    const max = 5;
    const windowMs = 15 * 60 * 1000;
    let lastRemaining = max;
    for (let i = 0; i < max; i++) {
      const r = await checkRateLimit(key, max, windowMs);
      expect(r.allowed).toBe(true);
      lastRemaining = r.remaining;
    }
    expect(lastRemaining).toBe(0);
    const over = await checkRateLimit(key, max, windowMs);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
  }, 10000);

  it('fail-closed: when checkRateLimit throws, auth-style middleware returns 503', async () => {
    const app = new Hono();
    const postgresRateLimiter =
      await import('../../src/utils/postgresRateLimiter');
    const checkSpy = jest
      .spyOn(postgresRateLimiter, 'checkRateLimit')
      .mockRejectedValue(new Error('db error'));
    const authLoginStyleLimiter = async (
      c: Context,
      next: Next
    ): Promise<Response | void> => {
      const key = 'auth_login:test-ip';
      const max = 5;
      const windowMs = 60 * 1000;
      try {
        await postgresRateLimiter.checkRateLimit(key, max, windowMs);
        return next();
      } catch {
        c.header('Retry-After', '60');
        return c.json(
          {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            error: 'Authentication service temporarily unavailable',
          },
          503
        );
      }
    };
    app.get('/auth/callback', authLoginStyleLimiter, (c) =>
      c.json({ ok: true })
    );
    const res = await app.request('/auth/callback', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(res.status).toBe(503);
    checkSpy.mockRestore();
  });
});
