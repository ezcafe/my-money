#!/usr/bin/env node
/**
 * Kill processes using specified ports
 * Usage: tsx scripts/kill-ports.ts [port1] [port2] ...
 */

import {exec} from 'child_process';
import {promisify} from 'util';

const execAsync = promisify(exec);

/**
 * Kill process using a specific port
 * @param port - Port number to kill
 */
async function killPort(port: number): Promise<void> {
  try {
    // Find process using the port
    const {stdout} = await execAsync(`lsof -ti :${port}`);
    const pids = stdout.trim().split('\n').filter(Boolean);

    if (pids.length === 0) {
      console.log(`✓ Port ${port} is free`);
      return;
    }

    // Kill all processes using the port
    for (const pid of pids) {
      try {
        await execAsync(`kill -9 ${pid}`);
        console.log(`✓ Killed process ${pid} on port ${port}`);
      } catch (error) {
        console.warn(`⚠ Failed to kill process ${pid} on port ${port}`);
      }
    }
  } catch (error: unknown) {
    // lsof returns non-zero exit code when no process is found
    // This is expected, so we just log that the port is free
    const execError = error as {code?: number; stderr?: string};
    if (execError.code === 1) {
      console.log(`✓ Port ${port} is free`);
    } else {
      console.warn(`⚠ Error checking port ${port}:`, execError.stderr || error);
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const ports = process.argv.slice(2).map(Number).filter((n) => !isNaN(n) && n > 0);

  if (ports.length === 0) {
    // Default ports if none specified
    ports.push(3000, 4000);
  }

  console.log(`Killing processes on ports: ${ports.join(', ')}`);
  await Promise.all(ports.map((port) => killPort(port)));
  console.log('Done');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

