// Render a handful of film frames to JPEG for a look check.
// usage: node tools/probe-frames.mjs <outDir> [--w 1280 --h 720 --variant desktop --quality draft] [--frames 84,300,...]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const isMain = process.argv[1] && process.argv[1].endsWith('probe-frames.mjs');
const w = +opt('--w', 1280), h = +opt('--h', 720), variant = opt('--variant', 'desktop'), quality = opt('--quality', 'draft'), look = opt('--look', 'day');
const base = process.env.FILM_BASE || 'http://localhost:3820';

export async function openFilm(browser, { w, h, variant, quality, look = 'day' }) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') console.log('[page]', m.type(), m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`${base}/world/film.html?w=${w}&h=${h}&variant=${variant}&quality=${quality}&look=${look}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.filmReady || window.filmError', { timeout: 300000 });
  const err = await page.evaluate('window.filmError');
  if (err) throw new Error(err);
  return page;
}

export function launch() {
  return puppeteer.launch({
    headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', protocolTimeout: 600000,
    userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'udha-film-')),
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio'],
  });
}

if (isMain) {
  const out = path.resolve(args[0] || 'probe');
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  try {
    const page = await openFilm(browser, { w, h, variant, quality, look });
    const L = await page.evaluate('window.film.layout');
    const pick = opt('--frames', null);
    const frames = pick ? pick.split(',').map(Number) : L.segments.filter((s) => s.type === 'idle').map((s) => s.start + 30).concat([0, 270, 1134]);
    for (const f of frames) {
      const t0 = Date.now();
      const r = await page.evaluate((f) => window.film.frame(f), f);
      fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}-${r.seg}.jpg`), Buffer.from(r.b64, 'base64'));
      console.log(f, r.seg, Date.now() - t0, 'ms', JSON.stringify(r.anchors).slice(0, 200));
    }
  } finally { await browser.close(); }
}
