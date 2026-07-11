import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@core': r('./src/core'),
      '@content': r('./src/content'),
      '@game': r('./src/game'),
      '@input': r('./src/input'),
      '@ui': r('./src/ui'),
      '@platform': r('./src/platform'),
      '@app': r('./src/app'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
