// A quiet dev server for the offline film render: no HMR, no file watching, so edits elsewhere never reload it.
import { defineConfig } from 'vite';
export default defineConfig({ server: { port: 3825, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } } });
