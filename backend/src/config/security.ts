/**
 * Security Configuration
 * Registers security plugins for Fastify server
 */

import type {FastifyInstance} from 'fastify';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

/**
 * Register security plugins
 * @param fastify - Fastify instance
 */
export async function registerSecurityPlugins(fastify: FastifyInstance): Promise<void> {
  // CORS configuration - allow frontend to communicate with backend
  // Configured via CORS_ORIGIN environment variable (comma-separated list of allowed origins)
  // Defaults to localhost:3000 for development
  // Example: CORS_ORIGIN=http://localhost:3000,https://example.com
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  await fastify.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    // Allow multipart/form-data
    exposedHeaders: ['Content-Type'],
  });

  // Security headers with enhanced Content Security Policy
  // CSP helps mitigate XSS attacks by controlling which resources can be loaded
  // This is especially important since tokens are stored in localStorage
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // 'unsafe-inline' needed for Material-UI
        scriptSrc: ["'self'"], // Only allow scripts from same origin
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"], // Restrict GraphQL connections to same origin
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"], // Disallow plugins
        baseUri: ["'self'"], // Restrict base URI
        formAction: ["'self'"], // Restrict form submissions
        frameAncestors: ["'none'"], // Prevent clickjacking
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null, // Upgrade HTTP to HTTPS in production
      },
    },
    crossOriginEmbedderPolicy: false, // Allow GraphQL Playground in development
    // Additional security headers
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    xContentTypeOptions: true, // Prevent MIME type sniffing
    xFrameOptions: {action: 'deny'}, // Prevent clickjacking
    xXssProtection: true, // Enable XSS filter (legacy browsers)
  });

  // Rate limiting - general limit
  await fastify.register(rateLimit, {
    max: 100, // 100 requests
    timeWindow: '1 minute',
    skipOnError: false,
    errorResponseBuilder: (_request, context) => {
      return {
        code: 'RATE_LIMIT_EXCEEDED',
        error: 'Too many requests, please try again later',
        message: `Rate limit exceeded, retry in ${Math.ceil(context.ttl / 1000)} seconds`,
      };
    },
  });

  // Stricter rate limiting for file upload operations (uploadPDF, importCSV)
  // These operations are resource-intensive and should have lower limits
  fastify.addHook('onRequest', async (request, _reply) => {
    const body = request.body as {query?: string; variables?: Record<string, unknown>} | undefined;
    if (body?.query?.includes('uploadPDF') || body?.query?.includes('importCSV')) {
      // Apply stricter rate limit: 5 uploads per minute per user
      // This is handled per-user via the general rate limit, but we can add
      // additional checks here if needed. For now, the general rate limit applies.
      // In production, consider implementing per-user rate limiting with Redis
    }
  });

  // CSRF protection for mutations - validate Origin header
  fastify.addHook('onRequest', async (request, reply) => {
    const body = request.body as {query?: string} | undefined;
    if (body?.query?.includes('mutation')) {
      // For mutations, validate Origin header to prevent CSRF
      const origin = request.headers.origin;
      const referer = request.headers.referer;
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];

      // In production, require Origin or Referer header for mutations
      if (process.env.NODE_ENV === 'production') {
        if (allowedOrigins.length > 0) {
          const isValidOrigin =
            (origin !== undefined && allowedOrigins.includes(origin)) ||
            (referer !== undefined && allowedOrigins.some((allowed) => referer.startsWith(allowed)));

          if (!isValidOrigin) {
            return reply.code(403).send({
              errors: [
                {
                  message: 'CSRF validation failed',
                  extensions: {
                    code: 'FORBIDDEN',
                    statusCode: 403,
                  },
                },
              ],
            });
          }
        }
      }
    }
  });
}

