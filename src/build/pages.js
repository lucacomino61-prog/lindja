// Vite plugin: index.html, en/index.html and it/index.html are rendered from one template per language.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = import.meta.dirname;
const langOf = (p) => (p.startsWith('/en/') ? 'en' : p.startsWith('/it/') ? 'it' : 'sq');

export function pages() {
  return {
    name: 'udha-pages',
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        if (!/^\/((en|it)\/)?(index\.html)?$/.test(ctx.path)) return html; // the render pages under /world/ stay as they are
        const stamp = `?t=${Date.now()}`; // fresh modules on every dev request
        const load = async (p) => (await import(pathToFileURL(path.join(here, p)).href + stamp)).default;
        const [sq, en] = await Promise.all(['../content/sq.js', '../content/en.js'].map(load));
        const cars = (await import(pathToFileURL(path.join(here, '../content/cars.js')).href + stamp)).default;
        const { renderPage } = await import(pathToFileURL(path.join(here, 'render.js')).href + stamp);
        const all = [sq, en];
        const t = { sq, en }[langOf(ctx.path)];
        return renderPage(t, all, cars);
      },
    },
    configureServer(server) {
      // reload the pages when the template or the copy changes
      server.watcher.add([path.join(here, 'render.js'), path.join(here, '..', 'content')]);
      server.watcher.on('change', (f) => { if (f.includes(path.join('src', 'content')) || f.endsWith('render.js')) server.ws.send({ type: 'full-reload' }); });
    },
  };
}
