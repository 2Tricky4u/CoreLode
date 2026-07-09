import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
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
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  server: { port: 5173 },
});
