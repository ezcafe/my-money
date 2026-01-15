/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import rootConfig from '../eslint.config.mjs';

/**
 * Frontend ESLint configuration.
 * Extends root configuration with React and browser specific settings.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  ...rootConfig,
  {
    files: ['src/**/*.{ts,tsx}', '__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React recommended rules
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,

      // React specific overrides
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error', // Changed from 'warn' to 'error'
      'react/jsx-uses-react': 'off', // Not needed with new JSX transform
      'react/jsx-uses-vars': 'error',
      'react/no-unescaped-entities': 'warn',
      'react/self-closing-comp': 'warn',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/jsx-pascal-case': 'warn',
      'react/jsx-no-leaked-render': 'warn', // Prevent common React bugs
      'react/jsx-no-useless-fragment': 'warn',

      // TypeScript rules (explicitly set for clarity, inherited from root)
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off', // Too noisy for React components
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Too noisy for React components
      'prefer-const': 'error',
      'no-console': ['warn', {allow: ['warn', 'error']}],
    },
  },
];

