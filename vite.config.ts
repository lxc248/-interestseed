import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };

/**
 * Obsidian 要求插件根目录同时存在 main.js / manifest.json / styles.css。
 * 构建后把这些文件放进 dist，方便直接复制到 .obsidian/plugins/interestseed。
 */
function copyPluginAssets(): Plugin {
  return {
    name: 'interestseed-copy-assets',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(root, 'dist');
      mkdirSync(outDir, { recursive: true });

      const manifest = resolve(root, 'manifest.json');
      if (existsSync(manifest)) copyFileSync(manifest, resolve(outDir, 'manifest.json'));

      const styles = resolve(root, 'src/styles.css');
      if (existsSync(styles)) copyFileSync(styles, resolve(outDir, 'styles.css'));
    },
  };
}

export default defineConfig({
  plugins: [copyPluginAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2018',
    minify: false,
    sourcemap: true,
    lib: {
      entry: resolve(root, 'src/main.ts'),
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: ['obsidian', 'electron', /^node:/, ...builtinModules],
      output: {
        exports: 'named',
        banner: `/*! InterestSeed ${pkg.version} | Copyright (C) 2026 aicoder | AGPL-3.0-only | Original work; see NOTICE and LICENSE. */`,
      },
    },
  },
});
