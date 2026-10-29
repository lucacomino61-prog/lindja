// End-to-end checks for the home page with the live 3D hero, on the real GPU (headless Chrome, ANGLE/D3D11).
// usage: node tests/e2e-live.mjs [base url] [outDir for screenshots]
// Covers: first view (still) and the live world, the five stops through the scroll, hotspots, the rail, the Stop switch,
// reduced motion and no-WebGL fallbacks, past-the-hero (dock, header), the redesign's menu / garage / compare /
// calculator, phone layout, console errors.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../tools/probe-frames.mjs';

const base = (process.argv[2] || 'http://localhost:3821').replace(/\/$/, '');
const out = process.argv[3] && path.resolve(process.argv[3]);
if (out) fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const shot = async (p, name) => { if (out) await p.screenshot({ path: path.join(out, name + '.jpg'), type: 'jpeg', quality: 75 }); };

async function open(browser, url, { phone = false, before } = {}) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  if (phone) await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  else await p.setViewport({ width: 1440, height: 900 });
  const log = [];
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) log.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => log.push('pageerror: ' + e.message));
  if (before) await before(p);
  await p.goto(url, { waitUntil: 'load', timeout: 120000 });
  return { p, ctx, log };
}
// scroll to a place on the route (u 0..4), inverting the hero's dwell mapping
const toU = (p, u) => p.evaluate((u) => {
  const h = document.getElementById('lindja-film'), range = h.offsetHeight - h.querySelector('.hero__pin').offsetHeight;
  const k = Math.min(3, Math.floor(u)), f = u - k, D = 0.12, s = (k + (f === 0 ? 0 : D + f * (1 - 2 * D))) / 4;
  window.__udha.lenis.scrollTo(h.offsetTop + Math.min(0.9999, s) * range, { immediate: true, force: true });
}, u);
const heroState = (p) => p.evaluate(() => { const h = document.getElementById('lindja-film'); return { step: +h.dataset.step, live: h.classList.contains('is-live'), word: h.querySelector('.hero__word-in')?.textContent, spots: h.querySelectorAll('.spot.is-on').length, still: h.querySelector('.hero__poster img').getAttribute('src') }; });
const waitLive = (p) => p.waitForFunction(() => document.getElementById('lindja-film').classList.contains('is-live'), { timeout: 120000 }).then(() => true).catch(() => false);

const browser = await launch();
try {
  // ---------- desktop ----------
  let { p, ctx, log } = await open(browser, `${base}/`);
  check('first view is the still (LCP image), loader lifted', await p.evaluate(() => { const i = document.querySelector('.hero__poster img'); return i.complete && i.naturalWidth > 0 && document.querySelector('.loader').classList.contains('is-done'); }));
  check('the live world builds and fades in', await waitLive(p));
  const words = [];
  for (let k = 0; k <= 4; k++) {
    await toU(p, k); await sleep(1400);
    const s = await heroState(p);
    words.push(s.word);
    check(`stop ${k + 1}: label and hotspots`, s.step === k && s.spots > 0, JSON.stringify(s));
    await shot(p, `d-stop${k}`);
  }
  check('the five stops have five words', new Set(words).size === 5, words.join(' / '));
  // the ship sails with the scroll: her position changes between the stops
  const shipAt = async (u) => { await toU(p, u); await sleep(500); return p.evaluate(() => { const w = window.__udha.heroWorld(); let s = null; w.world.scene.traverse((o) => { if (o.userData.isShip && o.userData.setRamp && o.visible && !s) s = o.position.clone(); }); return s && [Math.round(s.x), Math.round(s.z)]; }); };
  const a = await shipAt(1), b = await shipAt(1.5), c = await shipAt(2), d = await shipAt(3);
  check('LINDJA STAR sails Incheon → sea → Durrës with the scroll', a[0] > 200 && b[0] < a[0] && Math.abs(c[0]) < 3 && d[0] < -200, JSON.stringify({ a, b, c, d }));
  await toU(p, 2); await sleep(800);
  check('the squall at sea: rain falls', await p.evaluate(() => { let r = null; window.__udha.heroWorld().world.camera.traverse((o) => { if (o.isLineSegments) r = o; }); return !!r && r.visible && r.material.uniforms.uRain.value > 0.9; }));
  await toU(p, 4); await sleep(800);
  check('golden hour in Tirana: no rain, warm sun', await p.evaluate(() => { const w = window.__udha.heroWorld().world; return w.sun.color.r > w.sun.color.b * 1.3; }));
  // the rail scrolls to its stop
  await toU(p, 0); await sleep(600);
  await p.evaluate(() => document.querySelector('.rail__btn[data-goto="3"]').click()); await sleep(2600);
  check('rail button scrolls to its stop', (await heroState(p)).step === 3);
  // a hotspot card opens and closes
  const opened = await p.evaluate(() => { const b = document.querySelector('.spot.is-on .spot__btn'); if (!b) return false; b.click(); return !document.getElementById(b.getAttribute('aria-controls')).hidden; });
  check('hotspot card opens', opened);
  await p.keyboard.press('Escape'); await sleep(200);
  check('Escape closes it', await p.evaluate(() => !document.querySelector('.spot__btn[aria-expanded="true"]')));
  // the Stop switch: stills take over, the canvas hides, the scroll still moves through the stops
  await p.evaluate(() => document.querySelector('.motion-toggle').click()); await sleep(400);
  await toU(p, 2); await sleep(900);
  const st = await heroState(p);
  check('Stop: stills by stop, canvas hidden', st.step === 2 && /scene-2-desktop/.test(st.still) && await p.evaluate(() => getComputedStyle(document.querySelector('.hero__canvas')).display === 'none'), JSON.stringify(st));
  await p.evaluate(() => document.querySelector('.motion-toggle').click()); await sleep(600);
  check('Resume: the live world again', (await heroState(p)).live);
  // past the hero
  await p.evaluate(() => { const h = document.getElementById('lindja-film'); window.__udha.lenis.scrollTo(h.offsetTop + h.offsetHeight + 300, { immediate: true, force: true }); }); await sleep(900);
  await p.evaluate(() => window.__udha.lenis.scrollTo(scrollY + 400, { immediate: true, force: true })); await sleep(700);
  check('past the hero: dock on, header tucked', await p.evaluate(() => document.querySelector('.dock').classList.contains('is-on') && document.querySelector('.site-header').classList.contains('is-tucked')));
  // the redesign's features
  await p.evaluate(() => { window.__udha.lenis.scrollTo(document.getElementById('makinat'), { immediate: true, force: true }); }); await sleep(900);
  await p.evaluate(() => { document.querySelectorAll('.car [data-save]')[0].click(); document.querySelectorAll('.car [data-compare]')[0].click(); document.querySelectorAll('.car [data-compare]')[1].click(); });
  check('garage and compare count', await p.evaluate(() => document.querySelector('[data-garage-n]').textContent === '1' && document.querySelector('[data-compare-n]').textContent === '2'));
  await p.evaluate(() => document.querySelector('[data-compare-open]').click()); await sleep(600);
  check('compare sheet lists two cars', await p.evaluate(() => document.getElementById('compare').open && document.querySelectorAll('#compare .cmp thead th').length === 2));
  await p.keyboard.press('Escape'); await sleep(300);
  await p.evaluate(() => { window.__udha.lenis.scrollTo(document.getElementById('financim'), { immediate: true, force: true }); const i = document.querySelector('.calc [name="price"]'); i.value = '31500'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(800);
  check('calculator: spoken figure updates', await p.evaluate(() => /592/.test(document.querySelector('[data-monthly-sr]').textContent)));
  check('desktop: no horizontal overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 0));
  check('desktop: no console errors', log.length === 0, log.slice(0, 3).join(' | '));
  await ctx.close();

  // ---------- phone ----------
  ({ p, ctx, log } = await open(browser, `${base}/`, { phone: true }));
  check('phone: live world builds', await waitLive(p));
  await toU(p, 2); await sleep(1200);
  const ps = await heroState(p);
  check('phone: the sea stop', ps.step === 2, JSON.stringify(ps));
  await shot(p, 'm-stop2');
  check('phone: no horizontal overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 0));
  check('phone: no console errors', log.length === 0, log.slice(0, 3).join(' | '));
  await ctx.close();

  // ---------- reduced motion: stills only, every stop reachable ----------
  ({ p, ctx, log } = await open(browser, `${base}/`, { before: (pg) => pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]) }));
  await sleep(4000);
  await toU(p, 3); await sleep(800);
  const rm = await heroState(p);
  check('reduced motion: no live world, the still of the stop', !rm.live && rm.step === 3 && /scene-3/.test(rm.still), JSON.stringify(rm));
  await ctx.close();

  // ---------- no WebGL 2: stills only ----------
  ({ p, ctx, log } = await open(browser, `${base}/`, { before: (pg) => pg.evaluateOnNewDocument(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { return t === 'webgl2' ? null : g.call(this, t, ...r); }; }) }));
  await sleep(5000);
  await toU(p, 1); await sleep(800);
  const ng = await heroState(p);
  check('no WebGL 2: stills, labels still move', !ng.live && ng.step === 1 && /scene-1/.test(ng.still), JSON.stringify(ng));
  check('no WebGL 2: no console errors', log.length === 0, log.slice(0, 3).join(' | '));
  await ctx.close();
} finally {
  await browser.close();
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} passed`);
  process.exitCode = pass === results.length ? 0 : 1;
}
