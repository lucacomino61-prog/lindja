// Renders the page stills into public/media: still-car-<img>.webp for the catalogue, still-ship.webp, still-transporter.webp.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './probe-frames.mjs';
import { CAR_IMAGES } from '../src/content/cars.js';

const root = path.resolve(import.meta.dirname, '..');
const media = path.join(root, 'public', 'media');
const base = process.env.FILM_BASE || 'http://localhost:3820';
const jobs = [...Object.entries(CAR_IMAGES).map(([k, [type, color]]) => [`still-car-${k}`, `car:${type}:${color}`]), ['still-ship', 'ship'], ['still-transporter', 'transporter']];

const browser = await launch();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 840 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`${base}/world/stills.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.stillsReady || window.stillsError', { timeout: 300000 });
  const err = await page.evaluate('window.stillsError');
  if (err) throw new Error(err);
  for (const [file, name] of jobs) {
    const b64 = await page.evaluate((n) => window.stills.cutout(n), name);
    fs.writeFileSync(path.join(media, `${file}.webp`), Buffer.from(b64, 'base64'));
    console.log(file);
  }
} finally {
  await browser.close();
}
