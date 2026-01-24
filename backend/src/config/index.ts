/**
 * Centralized Configuration
 * All application configuration is managed here
 * Environment variables are validated and typed
 */

import {existsSync, readFileSync} from 'fs';

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
 * Check if the application is running inside a Docker container
 * @returns True if running in Docker, false otherwise
 */
export function isRunningInDocker(): boolean {
  // Check for /.dockerenv file (most reliable method)
  try {
    if (existsSync('/.dockerenv')) {
      return true;
    }
  } catch {
    // If we can't check, continue with other methods
  }

  // Check cgroup (alternative method)
  try {
    const cgroup = readFileSync('/proc/self/cgroup', 'utf-8');
    return cgroup.includes('docker') || cgroup.includes('containerd');
  } catch {
    // If we can't read cgroup, assume not in Docker
    return false;
  }
}

/**
 * Adjust database connection string hostname based on environment
 * Allows using the same DATABASE_URL for both local and Docker:
 * - In Docker: converts 'localhost' to 'postgres' (service name)
 * - Local development: converts 'postgres' to 'localhost'
 *
 * This means you can use 'postgres' as the hostname in DATABASE_URL
 * for both environments, and it will automatically work.
 *
 * @param connectionString - Original database connection string
 * @returns Adjusted connection string with correct hostname
 */
export function adjustDatabaseConnectionString(connectionString: string): string {
  const inDocker = isRunningInDocker();

  if (inDocker) {
    // In Docker, replace localhost with postgres (the service name)
    if (connectionString.includes('@localhost:')) {
      return connectionString.replace('@localhost:', '@postgres:');
    }
  } else {
    // Local development: replace postgres with localhost
    if (connectionString.includes('@postgres:')) {
      return connectionString.replace('@postgres:', '@localhost:');
    }
  }

  return connectionString;
}

/**
 * Get database URL with validation
 * Reads directly from process.env to get the current value
 * If DATABASE_URL is not set, constructs it from POSTGRES_* env vars
 * @returns Database URL string
 * @throws Error if DATABASE_URL cannot be determined
 */
export function getDatabaseUrl(): string {
  let url = process.env.DATABASE_URL;

  // If DATABASE_URL is not set or empty, construct from components
  if (!url) {
    const user = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;
    const host = process.env.POSTGRES_HOST ?? 'postgres';
    const port = process.env.POSTGRES_PORT ?? '5432';
    const database = process.env.POSTGRES_DB ?? 'mymoney';

    if (user && password) {
      url = `postgresql://${user}:${password}@${host}:${port}/${database}`;
    }
  }

  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set and cannot be constructed from POSTGRES_* vars');
  }

  // Validate the URL format - must contain user info
  if (!url.includes('@') || !url.includes('://')) {
    throw new Error('DATABASE_URL is malformed - must be in format postgresql://user:password@host:port/database');
  }

  return url;
}

/**
 * Get database configuration
 * Note: url is read lazily via getDatabaseUrl() to ensure current env value
 */
function getDatabaseConfig(): DatabaseConfig {
  const poolMax = Number(process.env.DB_POOL_MAX);
  const connectionTimeoutMs = Number(process.env.DB_CONNECTION_TIMEOUT_MS);
  const idleTimeoutMs = Number(process.env.DB_IDLE_TIMEOUT_MS);
  return {
    // Use getter to read DATABASE_URL lazily at access time and adjust hostname
    get url(): string {
      const url = getDatabaseUrl();
      return adjustDatabaseConnectionString(url);
    },
    poolMax: Number.isNaN(poolMax) ? 100 : poolMax,
    connectionTimeoutMs: Number.isNaN(connectionTimeoutMs) ? 10000 : connectionTimeoutMs,
    idleTimeoutMs: Number.isNaN(idleTimeoutMs) ? 30000 : idleTimeoutMs,
  } as DatabaseConfig;
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
