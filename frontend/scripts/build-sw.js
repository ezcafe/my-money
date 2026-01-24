/**
 * Build script for service worker
 * Compiles TypeScript service worker to JavaScript
 */

import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const isProduction = process.env.NODE_ENV === 'production';

await build({
  entryPoints: [resolve(rootDir, 'src/service-worker/sw.ts')],
  bundle: true,
  outfile: resolve(rootDir, 'dist/sw.js'),
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  minify: isProduction,
  sourcemap: !isProduction,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});

console.log(`Service worker built successfully (${isProduction ? 'production' : 'development'})`);
