import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import-x';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'import/no-cycle': ['error', { maxDepth: 3, ignoreExternal: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Rule: packages/rag cannot import db or express
    files: ['packages/rag/**/*.{ts,js}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@docsage/db',
              message:
                'Architecture violation: packages/rag is pure business logic and cannot import database layers (@docsage/db).',
            },
            {
              name: 'express',
              message:
                'Architecture violation: packages/rag cannot import web framework (express).',
            },
          ],
          patterns: [
            {
              group: ['*packages/db/**', '**/packages/db/**'],
              message: 'Architecture violation: packages/rag cannot import database packages or paths.',
            },
            {
              group: ['express', 'express/**'],
              message: 'Architecture violation: packages/rag cannot import express.',
            },
          ],
        },
      ],
    },
  },
  {
    // Rule: apps/web cannot import apps/api
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@docsage/api',
              message:
                'Architecture violation: apps/web is client-side code and cannot import apps/api.',
            },
          ],
          patterns: [
            {
              group: ['*apps/api/**', '**/apps/api/**'],
              message: 'Architecture violation: apps/web cannot import from apps/api.',
            },
          ],
        },
      ],
    },
  },
  {
    // Rule: only packages/db withTenant touches the pool
    files: ['packages/**/*.{ts,js}', 'apps/**/*.{ts,js,tsx}'],
    ignores: ['packages/db/src/client.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportSpecifier[imported.name="pool"]',
          message:
            'Architecture violation: Direct connection pool access is forbidden. Only withTenant() may touch the pool.',
        },
        {
          selector: 'MemberExpression[object.name="pool"][property.name="connect"]',
          message:
            'Architecture violation: Direct pool.connect() is forbidden outside withTenant().',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      complexity: 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/build/**',
      '**/*.config.*',
      '**/*.d.ts',
      'docs/**',
      'evals/dataset/**',
      'infra/k6/**',
      'e2e/**',
      'scripts/**',
    ],
  },
);
