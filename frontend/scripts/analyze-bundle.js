#!/usr/bin/env node
/**
 * Bundle Analysis Script
 * Analyzes webpack bundle to identify optimization opportunities
 * Usage: npm run analyze
 */

import {spawn} from 'child_process';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Set ANALYZE environment variable and run webpack build
process.env.ANALYZE = 'true';
process.env.NODE_ENV = 'production';

const webpackProcess = spawn('npm', ['run', 'build'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
});

webpackProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Bundle analysis complete!');
    console.log('📊 Open dist/bundle-report.html in your browser to view the analysis.');
  } else {
    console.error(`\n❌ Bundle analysis failed with code ${code}`);
    process.exit(code ?? 1);
  }
});

webpackProcess.on('error', (error) => {
  console.error('Failed to start webpack process:', error);
  process.exit(1);
});
