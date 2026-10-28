// Quick page smoke test: console errors, hero state after load, one wheel step, screenshots.
// usage: node tools/smoke.mjs <outDir> [--url http://localhost:3820/] [--phone]
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './probe-frames.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const out = path.resolve(args[0] || 'smoke');
fs.mkdirSync(out, { recursive: true });
const url = opt('--url', 'http://localhost:3820/');
const phone = args.includes('--phone');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await launch();
try {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  if (phone) await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  else await page.setViewport({ width: 1440, height: 900 });
  const logs = [];
  page.on('console', (m) => { if (['error', 'warn'].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => logs.push(`failed: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await sleep(7000);
  const state = async () => page.evaluate(() => {
    const v = [...document.querySelectorAll('.hero__video')];
    return {
      step: document.querySelector('.hero')?.dataset.step, loader: document.querySelector('.loader')?.className,
      videos: v.map((x) => ({ on: x.classList.contains('is-on'), t: +x.currentTime.toFixed(2), paused: x.paused, rs: x.readyState })),
      spotsOn: [...document.querySelectorAll('.spot.is-on')].map((s) => s.dataset.anchor), scrollY, locked: document.querySelector('.hero')?.classList.contains('is-locked'),
    };
  });
  console.log('after load', JSON.stringify(await state()));
  await page.screenshot({ path: path.join(out, `${phone ? 'm' : 'd'}-0.jpg`), type: 'jpeg', quality: 72 });
  if (phone) {
    await page.touchscreen.touchStart(195, 600); await page.touchscreen.touchMove(195, 300); await page.touchscreen.touchEnd();
  } else { await page.mouse.move(700, 450); await page.mouse.wheel({ deltaY: 120 }); }
  await sleep(1200);
  console.log('mid move', JSON.stringify(await state()));
  await page.screenshot({ path: path.join(out, `${phone ? 'm' : 'd'}-1-mid.jpg`), type: 'jpeg', quality: 72 });
  await sleep(2400);
  console.log('after move', JSON.stringify(await state()));
  await page.screenshot({ path: path.join(out, `${phone ? 'm' : 'd'}-1.jpg`), type: 'jpeg', quality: 72 });
  console.log(logs.length ? logs.join('\n') : 'no console errors');
} finally {
  await browser.close();
}
