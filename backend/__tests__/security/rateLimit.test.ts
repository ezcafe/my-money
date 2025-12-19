/**
 * Rate Limiting Security Tests
 */

import {describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

describe('Rate Limiting', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(rateLimit, {
      max: 5, // 5 requests for testing
      timeWindow: '1 minute',
    });

    fastify.get('/test', async () => {
      return {message: 'ok'};
    });
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should allow requests within limit', async () => {
    await fastify.ready();

    for (let i = 0; i < 5; i++) {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it('should reject requests exceeding limit', async () => {
    await fastify.ready();

    // Make 5 requests (within limit)
    for (let i = 0; i < 5; i++) {
      await fastify.inject({
        method: 'GET',
        url: '/test',
      });
    }

    // 6th request should be rate limited
    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
    });
    expect(response.statusCode).toBe(429);
  });
});

