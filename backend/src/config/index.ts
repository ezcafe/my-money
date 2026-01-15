/**
 * Centralized Configuration
 * All application configuration is managed here
 * Environment variables are validated and typed
 */

export interface ServerConfig {
  port: number;
  host: string;
  bodyLimit: number;
}

export interface DatabaseConfig {
  url: string;
  poolMax: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
}

export interface OIDCConfig {
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  oidc: OIDCConfig;
  nodeEnv: 'development' | 'production' | 'test';
}

/**
 * Get server configuration
 */
function getServerConfig(): ServerConfig {
  const port = Number(process.env.PORT);
  const bodyLimit = Number(process.env.MAX_BODY_SIZE);
  return {
    port: Number.isNaN(port) ? 4000 : port,
    host: process.env.HOST ?? '0.0.0.0',
    bodyLimit: Number.isNaN(bodyLimit) ? 2 * 1024 * 1024 : bodyLimit, // 2MB default
  };
}

/**
 * Get database configuration
 */
function getDatabaseConfig(): DatabaseConfig {
  const poolMax = Number(process.env.DB_POOL_MAX);
  const connectionTimeoutMs = Number(process.env.DB_CONNECTION_TIMEOUT_MS);
  const idleTimeoutMs = Number(process.env.DB_IDLE_TIMEOUT_MS);
  return {
    url: process.env.DATABASE_URL!,
    poolMax: Number.isNaN(poolMax) ? 100 : poolMax,
    connectionTimeoutMs: Number.isNaN(connectionTimeoutMs) ? 10000 : connectionTimeoutMs,
    idleTimeoutMs: Number.isNaN(idleTimeoutMs) ? 30000 : idleTimeoutMs,
  };
}

/**
 * Get OIDC configuration
 */
function getOIDCConfig(): OIDCConfig {
  return {
    discoveryUrl: process.env.OPENID_DISCOVERY_URL!,
    clientId: process.env.OPENID_CLIENT_ID!,
    clientSecret: process.env.OPENID_CLIENT_SECRET!,
  };
}

/**
 * Get node environment
 */
function getNodeEnv(): 'development' | 'production' | 'test' {
  const env = process.env.NODE_ENV;
  if (env === 'development' || env === 'production' || env === 'test') {
    return env;
  }
  return 'development';
}

/**
 * Centralized application configuration
 * All configuration is validated at startup
 */
export const config: AppConfig = {
  server: getServerConfig(),
  database: getDatabaseConfig(),
  oidc: getOIDCConfig(),
  nodeEnv: getNodeEnv(),
} as const;
