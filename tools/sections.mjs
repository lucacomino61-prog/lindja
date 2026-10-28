// Screenshots of every section below the film, at desktop or phone size: node tools/sections.mjs <outDir> [--phone]
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './probe-frames.mjs';

const out = path.resolve(process.argv[2] || 'sections');
const phone = process.argv.includes('--phone');
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await launch();
try {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  if (phone) await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  else await p.setViewport({ width: 1440, height: 900 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto(process.env.SITE || 'http://localhost:3820/', { waitUntil: 'load' });
  await sleep(5000);
  await p.evaluate(() => window.__udha.leaveHero?.());
  for (const id of ['manifest', 'makinat', 'importi', 'porosi', 'financim', 'sallonet', 'test-drive', 'udhezues', 'kontakt']) {
    await p.evaluate((id) => { const el = document.getElementById(id); window.__udha.lenis.scrollTo(el, { immediate: true }); }, id);
    await sleep(900);
    await p.screenshot({ path: path.join(out, `${phone ? 'm' : 'd'}-${id}.jpg`), type: 'jpeg', quality: 70 });
  }
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log('overflow-x', overflow, errs.length ? errs.join('\n') : 'no errors');
} finally { await b.close(); }
