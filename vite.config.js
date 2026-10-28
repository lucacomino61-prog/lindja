import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { pages } from './src/build/pages.js';

export default defineConfig({
  plugins: [pages()],
  server: { watch: { ignored: ['**/renders/**', '**/public/media/**', '**/.impeccable/**', '**/tools/out/**', '**/renders-run.log'] } },
  build: {
    rollupOptions: {
      input: {
        sq: resolve(import.meta.dirname, 'index.html'),
        en: resolve(import.meta.dirname, 'en/index.html'),
      },
    },
  },
});
