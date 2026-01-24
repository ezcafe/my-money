#!/usr/bin/env node
/**
 * Post-build script to add .js extensions to relative imports in compiled ESM code
 * Node.js ESM requires explicit file extensions for relative imports
 */

import {readdir, readFile, writeFile, stat} from 'fs/promises';
import {join, dirname, extname} from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = join(__dirname, '..', 'dist');

/**
 * Recursively find all .js files in a directory
 */
async function findJSFiles(dir) {
  const files = [];
  const entries = await readdir(dir, {withFileTypes: true});

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findJSFiles(fullPath));
    } else if (entry.isFile() && extname(entry.name) === '.js') {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a path points to a directory with index.js
 */
async function isDirectoryWithIndex(importPath, currentFileDir) {
  try {
    const resolvedPath = join(currentFileDir, importPath);
    const stats = await stat(resolvedPath);
    if (stats.isDirectory()) {
      // Check if index.js exists in this directory
      try {
        await stat(join(resolvedPath, 'index.js'));
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    // Path doesn't exist or is a file
  }
  return false;
}

/**
 * Fix relative imports in a file by adding .js extension
 * Matches: from './path' or from '../path' or import './path'
 * Also matches: await import('./path') (dynamic imports)
 * But excludes: from './path.js' (already has extension)
 * And excludes: from 'package' (node_modules imports)
 * Handles directory imports by converting to index.js
 */
async function fixImports(content, filePath) {
  const fileDir = dirname(filePath);
  let result = content;
  let offset = 0;

  // Match static imports/requires: (import|export|from|require)\s+['"](\.\.?\/[^'"]*?)(?<!\.js)['"]
  const staticImportRegex = /(import|export|from|require)\s+(['"])(\.\.?\/[^'"]*?)(?<!\.js)(['"])/g;
  
  // Match dynamic imports: await import(['"](\.\.?\/[^'"]*?)(?<!\.js)['"])
  const dynamicImportRegex = /await\s+import\s*\(\s*(['"])(\.\.?\/[^'"]*?)(?<!\.js)(['"])\s*\)/g;

  // Process static imports
  const staticMatches = [...content.matchAll(staticImportRegex)];
  for (const match of staticMatches) {
    const keyword = match[1];
    const quote1 = match[2];
    const path = match[3];
    const quote2 = match[4];
    const start = match.index + offset;
    const end = start + match[0].length;

    // Skip if it already has an extension (other than .js which we're adding)
    if (path.match(/\.[a-zA-Z]+$/)) {
      continue;
    }

    // Check if this is a directory import (has index.js)
    const isDirImport = await isDirectoryWithIndex(path, fileDir);
    let newPath;
    if (isDirImport) {
      // Convert directory import to index.js
      newPath = `${path}/index.js`;
    } else {
      // Add .js extension to file import
      newPath = `${path}.js`;
    }

    const replacement = `${keyword} ${quote1}${newPath}${quote2}`;
    result = result.slice(0, start) + replacement + result.slice(end);
    offset += replacement.length - match[0].length;
  }

  // Reset offset for dynamic imports (process them separately)
  offset = 0;
  const originalResult = result;
  
  // Process dynamic imports
  const dynamicMatches = [...result.matchAll(dynamicImportRegex)];
  for (const match of dynamicMatches) {
    const quote1 = match[1];
    const path = match[2];
    const quote2 = match[3];
    const start = match.index + offset;
    const end = start + match[0].length;

    // Skip if it already has an extension (other than .js which we're adding)
    if (path.match(/\.[a-zA-Z]+$/)) {
      continue;
    }

    // Check if this is a directory import (has index.js)
    const isDirImport = await isDirectoryWithIndex(path, fileDir);
    let newPath;
    if (isDirImport) {
      // Convert directory import to index.js
      newPath = `${path}/index.js`;
    } else {
      // Add .js extension to file import
      newPath = `${path}.js`;
    }

    const replacement = `await import(${quote1}${newPath}${quote2})`;
    result = result.slice(0, start) + replacement + result.slice(end);
    offset += replacement.length - match[0].length;
  }

  return result;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Fixing ESM imports in compiled code...');

    // Check if dist/src exists
    try {
      const stats = await stat(DIST_DIR);
      if (!stats.isDirectory()) {
        console.error(`Error: ${DIST_DIR} is not a directory`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error: ${DIST_DIR} does not exist. Run 'npm run build' first.`);
      process.exit(1);
    }

    // Find all .js files
    const files = await findJSFiles(DIST_DIR);
    console.log(`Found ${files.length} JavaScript files to process`);

    let fixedCount = 0;
    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      const fixed = await fixImports(content, file);

      if (content !== fixed) {
        await writeFile(file, fixed, 'utf-8');
        fixedCount++;
        console.log(`Fixed imports in: ${file.replace(process.cwd(), '.')}`);
      }
    }

    console.log(`\n✓ Fixed imports in ${fixedCount} files`);
  } catch (error) {
    console.error('Error fixing imports:', error);
    process.exit(1);
  }
}

main();
