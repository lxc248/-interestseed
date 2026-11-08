import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const version = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')).version as string;

export default defineConfig({
  define: { __INTERESTSEED_VERSION__: JSON.stringify(version) },
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
