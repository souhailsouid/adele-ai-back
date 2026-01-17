/**
 * ESLint Configuration - Cost Safety Rules (Flat Config for ESLint 9+)
 * 
 * Interdit l'utilisation de s3-direct-read.ts dans le code de production
 * pour éviter les catastrophes de coûts S3 (43M requêtes GET = $18/jour)
 */

import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: false, // Pas de type checking pour l'instant
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // 🔒 COST SAFETY: Interdire s3-direct-read dans le code de production
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../athena/s3-direct-read',
              message: '❌ FORBIDDEN: s3-direct-read is DISABLED in production (cost safety). This generated 43M+ S3 GET requests ($18/day). Use Athena with Lambda cache or DynamoDB lookup-index instead. Only allowed in dev-tools/ or test scripts.',
            },
            {
              name: '@/athena/s3-direct-read',
              message: '❌ FORBIDDEN: s3-direct-read is DISABLED in production (cost safety).',
            },
            {
              name: './athena/s3-direct-read',
              message: '❌ FORBIDDEN: s3-direct-read is DISABLED in production (cost safety).',
            },
          ],
          patterns: [
            {
              group: ['**/athena/s3-direct-read'],
              message: '❌ FORBIDDEN: s3-direct-read is DISABLED in production (cost safety). Use Athena with cache or DynamoDB index instead.',
            },
          ],
        },
      ],
      // Désactiver certaines règles pour l'instant
      'no-undef': 'off', // TypeScript gère déjà ça
      'no-unused-vars': 'off', // TypeScript gère déjà ça
    },
  },
  {
    // ✅ Exception: scripts dans dev-tools/ peuvent utiliser s3-direct-read (migrations one-shot)
    files: [
      'dev-tools/**/*.ts',
      'scripts/test_*.ts',
      'scripts/migrate_*.ts',
      'scripts/verify_*.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // Ignorer certains dossiers
    ignores: [
      'node_modules/**',
      'dist/**',
      '**/*.js',
      '**/*.mjs',
      'DOCUMENTATIONS/**',
      'layers/**',
      'workers/**/dist/**',
      'services/**/dist/**',
    ],
  },
];
