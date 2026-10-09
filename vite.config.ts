import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@core': src('core'),
      '@game': src('phaser'),
      '@data': src('data'),
      '@audio': src('audio'),
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: { include: ['tests/**/*.test.ts'] },
});
