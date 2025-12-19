import globals from 'globals';
import tseslint from 'typescript-eslint';
import rootConfig from '../eslint.config.mjs';

/**
 * Backend ESLint configuration.
 * Extends root configuration with Node.js and Jest specific settings.
 * 
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  ...rootConfig,
  {
    files: ['src/**/*.ts', '__tests__/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.es2022,
      },
    },
    rules: {
      // Backend-specific rules can be added here
    },
  },
];

