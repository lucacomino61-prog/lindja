// Share images (1200×630, one per language) and the PNG icons, drawn in headless Chrome from the site's own
// still, fonts and favicon. usage: node tools/render-share.mjs   → public/media/og-sq.jpg, og-en.jpg,
// public/favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './probe-frames.mjs';

const pub = path.resolve(import.meta.dirname, '..', 'public');
const url = (p) => pathToFileURL(path.join(pub, p)).href;
const share = {
  sq: { line: 'Makina nga Koreja e Jugut', sub: 'Të reja dhe të përdorura · Incheon → Durrës → Tiranë', proto: 'Prototip — kompani e shpikur' },
  en: { line: 'Cars from South Korea', sub: 'New and used · Incheon → Durrës → Tirana', proto: 'Prototype — an invented company' },
};
const page = (s) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: BS; src: url('${url('fonts/bigshoulders-latin.woff2')}'); font-weight: 100 900; }
@font-face { font-family: BSX; src: url('${url('fonts/bigshoulders-latin-ext.woff2')}'); font-weight: 100 900; unicode-range: U+0100-024F; }
@font-face { font-family: G; src: url('${url('fonts/geist.woff2')}'); font-weight: 100 900; }
@font-face { font-family: GM; src: url('${url('fonts/geist-mono.woff2')}'); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; position: relative; overflow: hidden; background: #DCE5E4; font-family: G; color: #101418; }
.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.fade { position: absolute; inset: auto 0 0; height: 62%; background: linear-gradient(to top, #EEF0EC 0%, rgb(238 240 236 / 0.92) 38%, transparent 100%); }
.brand { position: absolute; left: 48px; top: 40px; padding: 10px 18px 14px; background: #FF4F12; border-radius: 4px; font: 800 64px/0.8 BS; letter-spacing: -1px; }
.proto { position: absolute; right: 48px; top: 48px; padding: 8px 12px; background: #101418; color: #EEF0EC; border-radius: 3px; font: 500 18px/1 GM; text-transform: uppercase; letter-spacing: 0.04em; }
.line { position: absolute; left: 44px; right: 44px; bottom: 96px; font: 800 116px/0.92 BS, BSX; text-transform: uppercase; letter-spacing: -1px; text-wrap: balance; }
.sub { position: absolute; left: 48px; bottom: 44px; font: 500 30px/1 G; color: #2B3035; }
</style></head><body><img class="bg" src="${url('media/scene-1-desktop.webp')}"><div class="fade"></div><div class="brand">lindja</div><div class="proto">${s.proto}</div><div class="line">${s.line}</div><div class="sub">${s.sub}</div></body></html>`;

const b = await launch();
try {
  const p = await (await b.createBrowserContext()).newPage();
  for (const [lang, s] of Object.entries(share)) {
    await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    // opened as a file (outside the project): an about:blank page may not load the file:// fonts and still
    const tmp = path.join(os.tmpdir(), `lindja-og-${lang}.html`);
    fs.writeFileSync(tmp, page(s));
    await p.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(pub, 'media', `og-${lang}.jpg`), type: 'jpeg', quality: 86 });
    console.log(`og-${lang}.jpg`);
  }
  const svg = fs.readFileSync(path.join(pub, 'favicon.svg'), 'utf8');
  for (const [name, size, pad] of [['favicon-32.png', 32, 0], ['apple-touch-icon.png', 180, 0], ['icon-192.png', 192, 0], ['icon-512.png', 512, 0]]) {
    await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    // icons are square and full-bleed (iOS rounds them itself): drop the svg's corner radius
    await p.setContent(`<html><body style="margin:0;background:#FF4F12">${svg.replace('rx="4"', 'rx="0"').replace('<svg ', `<svg width="${size - pad * 2}" height="${size - pad * 2}" style="display:block" `)}</body></html>`);
    await p.screenshot({ path: path.join(pub, name), type: 'png', omitBackground: false });
    console.log(name);
  }
} finally { await b.close(); }
