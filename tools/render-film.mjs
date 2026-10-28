// Renders the world film offline and encodes it: public/media/world-<variant>.mp4, posters, and film.json
// (segment table + hotspot tracks). usage: node tools/render-film.mjs [--variant desktop|phone|both] [--every 1]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { launch, openFilm } from './probe-frames.mjs';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const which = opt('--variant', 'both');
const SIZES = { desktop: [1920, 1080, 27], phone: [810, 1440, 28] };
const work = path.join(root, 'renders');
const media = path.join(root, 'public', 'media');
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(media, { recursive: true });
const log = (...a) => { const line = `[${new Date().toISOString().slice(11, 19)}] ${a.join(' ')}`; console.log(line); fs.appendFileSync(path.join(work, 'render.log'), line + '\n'); };

async function renderVariant(browser, variant) {
  const [w, h, crf] = SIZES[variant];
  const page = await openFilm(browser, { w, h, variant, quality: 'film' });
  const L = await page.evaluate('window.film.layout');
  const sceneAnchors = await page.evaluate(() => window.film.world.stations.map((s) => s.anchors.map((a) => a.id)));
  const keyTimes = [...new Set(L.segments.flatMap((s) => [s.start, s.start + (s.loopLen || 0)]))].map((f) => (f / L.fps).toFixed(4)).join(',');
  const tmp = path.join(work, `world-${variant}.mp4`);
  const enc = spawn(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(L.fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-g', '96', '-keyint_min', '12', '-sc_threshold', '0',
    '-force_key_frames', keyTimes, '-movflags', '+faststart', '-an', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  const write = (buf) => new Promise((res) => (enc.stdin.write(buf) ? res() : enc.stdin.once('drain', res)));

  const tracks = {}; // segment name -> { anchorId: [x,y,...] }
  const t0 = Date.now();
  for (let f = 0; f < L.frames; f++) {
    const seg = L.segments.find((s) => f >= s.start && f < s.start + s.len);
    const scenes = seg.type === 'idle' ? [seg.scene] : [seg.from, seg.to].filter((k) => k >= 0);
    const ids = scenes.flatMap((k) => sceneAnchors[k]);
    const r = await page.evaluate((f, ids) => window.film.frame(f, { ids, q: 0.93 }), f, ids);
    await write(Buffer.from(r.b64, 'base64'));
    const tr = (tracks[seg.name] ||= {});
    for (const id of ids) { const p = r.anchors[id]; (tr[id] ||= []).push(p ? +p[0].toFixed(4) : null, p ? +p[1].toFixed(4) : null); }
    // stills: the first frame of every loop and of the film
    if (f === 0 || (seg.type === 'idle' && f === seg.start)) {
      const name = f === 0 ? 'intro' : `scene-${seg.scene}`;
      const webp = await page.evaluate(async () => {
        const c = document.getElementById('c');
        const b = await new Promise((r) => c.toBlob(r, 'image/webp', 0.8));
        return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(b); });
      });
      fs.writeFileSync(path.join(work, `${name}-${variant}.webp`), Buffer.from(webp, 'base64'));
    }
    if (f % 48 === 0) {
      const el = (Date.now() - t0) / 1000, eta = el / (f + 1) * (L.frames - f - 1);
      log(variant, `frame ${f}/${L.frames}`, seg.name, `${el.toFixed(0)}s elapsed, ~${(eta / 60).toFixed(1)} min left`);
    }
  }
  enc.stdin.end();
  await done;
  await page.close();
  return { L, tracks, size: [w, h] };
}

const browser = await launch();
const out = { fps: null, frames: null, segments: null, variants: {} };
try {
  for (const v of which === 'both' ? ['desktop', 'phone'] : [which]) {
    log('start', v);
    const r = await renderVariant(browser, v);
    out.fps = r.L.fps; out.frames = r.L.frames; out.period = r.L.period;
    out.segments = r.L.segments.map(({ name, type, scene, from, to, start, len, loopLen }) => ({ name, type, scene, from, to, start, len, loopLen }));
    out.variants[v] = { size: r.size, src: `/media/world-${v}.mp4`, tracks: r.tracks };
    for (const f of fs.readdirSync(work)) if (f.endsWith(`-${v}.mp4`) || f.endsWith(`-${v}.webp`)) fs.copyFileSync(path.join(work, f), path.join(media, f));
    log('done', v, (fs.statSync(path.join(media, `world-${v}.mp4`)).size / 1048576).toFixed(2), 'MB');
  }
  const prev = fs.existsSync(path.join(media, 'film.json')) ? JSON.parse(fs.readFileSync(path.join(media, 'film.json'), 'utf8')) : null;
  if (prev && which !== 'both') out.variants = { ...prev.variants, ...out.variants };
  fs.writeFileSync(path.join(media, 'film.json'), JSON.stringify(out));
  log('film.json written');
} finally {
  await browser.close();
}
