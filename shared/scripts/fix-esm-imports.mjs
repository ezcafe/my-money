#!/usr/bin/env node
/**
 * Post-build script to add .js extensions to relative imports in compiled ESM files
 * This is needed because Node.js ESM requires explicit file extensions,
 * but TypeScript with moduleResolution: "bundler" doesn't add them automatically
 */

import {readdir, readFile, writeFile} from 'fs/promises';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, '../dist');

/**
 * Recursively process all .js files in the dist directory
 * @param {string} dir - Directory to process
 * @returns {Promise<void>}
 */
async function processDirectory(dir) { // eslint-disable-line @typescript-eslint/explicit-function-return-type
  const entries = await readdir(dir, {withFileTypes: true});

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      await processFile(fullPath, dir);
    }
  }
}

/**
 * Process a single .js file to add .js extensions to relative imports
 * @param {string} filePath - Path to the file
 * @param {string} _fileDir - Directory containing the file (unused, kept for future use)
 * @returns {Promise<void>}
 */
async function processFile(filePath, _fileDir) { // eslint-disable-line @typescript-eslint/explicit-function-return-type
  let content = await readFile(filePath, 'utf-8');
  let modified = false;

  // Match relative imports/exports: from './path' or from '../path'
  // but not from './path.js' (already has extension)
  // and not from '@package/name' (package imports)
  const importExportRegex = /(?:import|export)(?:\s+type)?(?:\s+.*?\s+from\s+)?['"](\.\.?\/[^'"]*?)(?<!\.js)['"]/g;

  content = content.replace(importExportRegex, (match, importPath) => {
    // Type guard: ensure importPath is a string
    if (typeof importPath !== 'string') {
      return match;
    }

    // Skip if it's not a relative path or already has an extension
    if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
      return match;
    }

    // Add .js extension
    modified = true;
    const newImportPath = `${importPath}.js`;
    return match.replace(importPath, newImportPath);
  });

  if (modified) {
    await writeFile(filePath, content, 'utf-8');
  }
}

// Main execution
try {
  await processDirectory(distDir);
  // Success message - using warn as console.log is not allowed
  console.warn('✓ Fixed ESM imports in dist directory');
} catch (error) {
  console.error('Error processing files:', error);
  process.exit(1);
}
