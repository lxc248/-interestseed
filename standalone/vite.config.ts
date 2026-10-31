import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: resolve(import.meta.dirname, 'src/cli.ts'),
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: {
      output: {
        entryFileNames: 'cli.js',
      },
    },
  },
});
