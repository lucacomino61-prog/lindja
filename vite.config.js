import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { pages } from './src/build/pages.js';

export default defineConfig({
  appType: 'mpa', // unknown paths answer 404 locally too, instead of the home page
  plugins: [pages()],
  server: { watch: { ignored: ['**/renders/**', '**/public/media/**', '**/.impeccable/**', '**/tools/out/**', '**/renders-run.log'] } },
  build: {
    rollupOptions: {
      input: {
        sq: resolve(import.meta.dirname, 'index.html'),
        en: resolve(import.meta.dirname, 'en/index.html'),
        privatesia: resolve(import.meta.dirname, 'privatesia/index.html'),
        kushtet: resolve(import.meta.dirname, 'kushtet/index.html'),
        'en-privacy': resolve(import.meta.dirname, 'en/privacy/index.html'),
        'en-terms': resolve(import.meta.dirname, 'en/terms/index.html'),
        notfound: resolve(import.meta.dirname, '404.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
});
