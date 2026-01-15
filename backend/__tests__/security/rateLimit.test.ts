/**
 * Rate Limiting Security Tests
 */

import {describe, it, expect, beforeEach} from '@jest/globals';
import {Hono} from 'hono';

// Simple rate limiter for testing (same logic as in security.ts)
const rateLimitStore = new Map<string, {count: number; resetTime: number}>();

function rateLimiter(max: number, windowMs: number) {
  return async (c: Parameters<Parameters<Hono['use']>[0]>[0], next: () => Promise<void>): Promise<Response | void> => {
    const key = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'test-client';
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (record.count >= max) {
      return c.json({error: 'Rate limit exceeded'}, 429);
    }

    record.count += 1;
    return next();
  };
}

describe('Rate Limiting', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    rateLimitStore.clear();
    app.use(rateLimiter(5, 60 * 1000)); // 5 requests per minute for testing

    app.get('/test', async (c) => {
      return c.json({message: 'ok'});
    });
  });

  it('should allow requests within limit', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await app.request('/test', {
        method: 'GET',
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({message: 'ok'});
    }
  });

  it('should reject requests exceeding limit', async () => {
    // Make 5 requests (within limit)
    for (let i = 0; i < 5; i++) {
      await app.request('/test', {
        method: 'GET',
      });
    }

    // 6th request should be rate limited
    const response = await app.request('/test', {
      method: 'GET',
    });
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toEqual({error: 'Rate limit exceeded'});
  });
});
