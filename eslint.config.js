import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: 'error',
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['phaser', 'three', '@game/*', '**/phaser/**', '**/three/**', '**/ui/**'] },
      ],
    },
  },
  {
    files: ['src/audio/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['phaser', 'three', '@game/*', '**/phaser/**', '**/three/**'] },
      ],
    },
  },
  {
    // Node build scripts (e.g. npm run art) print what they wrote.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', Buffer: 'readonly', process: 'readonly' } },
    rules: { 'no-console': 'off' },
  },
);
