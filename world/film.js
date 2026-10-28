// Render page driven by tools/render-film.mjs: ?w=1920&h=1080&variant=desktop&quality=film
import { createWorld } from './world.js';
import fontUrl from '@fontsource-variable/big-shoulders-display/files/big-shoulders-display-latin-ext-wght-normal.woff2?url';
import fontUrl2 from '@fontsource-variable/big-shoulders-display/files/big-shoulders-display-latin-wght-normal.woff2?url';

const q = new URLSearchParams(location.search);
const width = +q.get('w') || 1920, height = +q.get('h') || 1080;
const variant = q.get('variant') || 'desktop';
const quality = q.get('quality') || 'film';
const look = q.get('look') || 'day';

async function boot() {
  for (const [u, range] of [[fontUrl2, 'U+0000-00FF'], [fontUrl, 'U+0100-024F']]) {
    const ff = new FontFace('Big Shoulders Display', `url(${u})`, { weight: '100 900', unicodeRange: range });
    document.fonts.add(await ff.load());
  }
  await document.fonts.load('800 100px "Big Shoulders Display"', 'udha ËË');
  const canvas = document.getElementById('c');
  canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
  const w = await createWorld({ width, height, variant, canvas, quality, look });
  // warm-up: compile every program once
  w.setFrame(0); w.renderer.compile(w.scene, w.camera); w.render();

  const toB64 = (blob) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
  window.film = {
    layout: w.layout,
    anchorIds: w.stations.flatMap((s) => s.anchors.map((a) => a.id)),
    async frame(f, { type = 'image/jpeg', q: quality = 0.94, ids = null } = {}) {
      const { seg } = w.setFrame(f);
      w.render();
      const blob = await new Promise((r) => canvas.toBlob(r, type, quality));
      return { b64: await toB64(blob), anchors: w.anchorsNow(ids), seg: seg.name };
    },
    world: w,
  };
  window.filmReady = true;
}
boot().catch((e) => { window.filmError = String(e && e.stack || e); console.error(e); });
