// Shared lint config for packages/* and apps/api. apps/app has its own (eslint-config-expo).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/.vercel/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Build scripts run in Node.
    files: ['**/scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly' } },
  },
  {
    // Connectors get `fetch` as a parameter and never log (tokens pass through them).
    files: ['packages/connectors/src/**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Use the fetch passed in deps.' },
      ],
    },
  },
);
