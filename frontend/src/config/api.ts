/**
 * Centralized API Configuration
 * Provides a single source of truth for API-related configuration
 */

import { GRAPHQL_REQUEST_TIMEOUT_MS } from '../constants';

/**
 * API configuration constants
 * GraphQL URL is injected at build time via webpack DefinePlugin
 * Falls back to localhost for development
 */
export const API_CONFIG = {
  /**
   * GraphQL endpoint URL
   * Configured via REACT_APP_GRAPHQL_URL environment variable
   * Defaults to http://localhost:4000/graphql if not set
   */
  graphqlUrl: process.env.REACT_APP_GRAPHQL_URL ?? 'http://localhost:4000/graphql',

  /**
   * WebSocket GraphQL endpoint URL for subscriptions
   * Configured via REACT_APP_WS_GRAPHQL_URL environment variable
   * Defaults to ws://localhost:4000/graphql-ws if not set
   */
  wsGraphqlUrl: process.env.REACT_APP_WS_GRAPHQL_URL ?? 'ws://localhost:4000/graphql-ws',

  /**
   * Request timeout in milliseconds
   * Default: 30 seconds
   */
  requestTimeoutMs: GRAPHQL_REQUEST_TIMEOUT_MS,
} as const;
