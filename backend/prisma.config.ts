/**
 * Prisma configuration file for Prisma 7+
 * This file replaces the datasource URL configuration that was previously in schema.prisma
 * The datasource URL is now configured here for Prisma Migrate commands
 */

import {readFileSync} from 'fs';
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

export default {
  datasource: {
    url: process.env.DATABASE_URL,
  },
};

