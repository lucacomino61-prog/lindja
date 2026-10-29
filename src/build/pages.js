// Vite plugin: every page is rendered from a template per language — the home page (render.js) and the privacy
// and terms pages (legal.js). The HTML files at those paths are stubs.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ORIGIN, ROUTES, isoDate } from './site.js';

// sitemap.xml at build: every page in both languages, each with its hreflang twins
function sitemap() {
  const url = (lang, kind) => ORIGIN + ROUTES[lang][kind];
  const urls = ['home', 'privacy', 'terms'].flatMap((kind) => ['sq', 'en'].map((lang) => `  <url>
    <loc>${url(lang, kind)}</loc>
    <lastmod>${isoDate()}</lastmod>
${['sq', 'en'].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${url(l, kind)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${url('sq', kind)}"/>
  </url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

const here = import.meta.dirname;
const PAGES = { '/': ['sq', 'home'], '/en/': ['en', 'home'], '/privatesia/': ['sq', 'privacy'], '/kushtet/': ['sq', 'terms'], '/en/privacy/': ['en', 'privacy'], '/en/terms/': ['en', 'terms'] };

export function pages() {
  return {
    name: 'lindja-pages',
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        const page = PAGES[ctx.path.replace(/index\.html$/, '')];
        if (!page) return html; // 404, admin and the render pages under /world/ stay as they are
        const [lang, kind] = page;
        const stamp = `?t=${Date.now()}`; // fresh modules on every dev request
        const load = async (p) => (await import(pathToFileURL(path.join(here, p)).href + stamp)).default;
        const [sq, en, cars, legal] = await Promise.all(['../content/sq.js', '../content/en.js', '../content/cars.js', '../content/legal.js'].map(load));
        const all = [sq, en];
        const t = { sq, en }[lang];
        if (kind === 'home') {
          const { renderPage } = await import(pathToFileURL(path.join(here, 'render.js')).href + stamp);
          return renderPage(t, all, cars);
        }
        const { renderLegal } = await import(pathToFileURL(path.join(here, 'legal.js')).href + stamp);
        return renderLegal(t, all, kind, legal);
      },
    },
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() }); },
    configureServer(server) {
      // reload the pages when a template or the copy changes
      server.watcher.add([path.join(here, 'render.js'), path.join(here, 'legal.js'), path.join(here, '..', 'content')]);
      server.watcher.on('change', (f) => { if (f.includes(path.join('src', 'content')) || /(render|legal)\.js$/.test(f)) server.ws.send({ type: 'full-reload' }); });
    },
  };
}
