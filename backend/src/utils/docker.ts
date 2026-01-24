/**
 * Docker environment detection utilities
 * Detects if the application is running inside a Docker container
 */

import { existsSync, readFileSync } from 'fs';

/**
 * Check if the application is running inside a Docker container
 * Uses multiple detection methods for reliability:
 * 1. Check for .dockerenv file (most reliable)
 * 2. Check for Docker-specific cgroup entries
 * 3. Check for container environment variables
 * @returns True if running inside Docker
 */
export function isRunningInDocker(): boolean {
  // Method 1: Check for .dockerenv file (most reliable indicator)
  if (existsSync('/.dockerenv')) {
    return true;
  }

  // Method 2: Check cgroup (if available)
  try {
    if (existsSync('/proc/self/cgroup')) {
      const cgroup = readFileSync('/proc/self/cgroup', 'utf-8');
      if (cgroup.includes('docker') || cgroup.includes('containerd')) {
        return true;
      }
    }
  } catch {
    // Ignore errors reading cgroup
  }

  // Method 3: Check for container environment variables
  // Docker Compose sets these, but they may not always be present
  if (process.env.COMPOSE_PROJECT_NAME || process.env.DOCKER_CONTAINER) {
    return true;
  }

  return false;
}
