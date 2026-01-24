/**
 * Prisma configuration file for Prisma 7+
 * This file replaces the datasource URL configuration that was previously in schema.prisma
 * The datasource URL is now configured here for Prisma Migrate commands
 */

import {readFileSync, existsSync} from 'fs';
import {resolve} from 'path';

/**
 * Load environment variables from .env file
 */
function loadEnvFile(): void {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    const lines = envFile.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value.trim();
          }
        }
      }
    }
  } catch (error) {
    // .env file might not exist, that's okay
    // Environment variables might be set another way
  }
}

// Load .env file if DATABASE_URL is not already set
if (!process.env.DATABASE_URL) {
  loadEnvFile();
}

/**
 * Check if running in Docker container
 */
function isRunningInDocker(): boolean {
  try {
    if (existsSync('/.dockerenv')) {
      return true;
    }
  } catch {
    // Continue with other methods
  }

  try {
    const cgroup = readFileSync('/proc/self/cgroup', 'utf-8');
    return cgroup.includes('docker') || cgroup.includes('containerd');
  } catch {
    return false;
  }
}

/**
 * Adjust database connection string hostname based on environment
 */
function adjustDatabaseConnectionString(connectionString: string): string {
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

// Adjust DATABASE_URL based on environment (Docker vs local)
const databaseUrl = process.env.DATABASE_URL;
const adjustedDatabaseUrl = databaseUrl ? adjustDatabaseConnectionString(databaseUrl) : undefined;

export default {
  datasource: {
    url: adjustedDatabaseUrl ?? databaseUrl,
  },
};

