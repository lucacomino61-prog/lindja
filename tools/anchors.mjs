// Print where each stop's hotspots land on screen at its loop start (desktop and phone).
import { launch, openFilm } from './probe-frames.mjs';
const b = await launch();
try {
  for (const [variant, w, h] of [['desktop', 480, 270], ['phone', 270, 480]]) {
    const p = await openFilm(b, { w, h, variant, quality: 'draft' });
    const out = await p.evaluate(() => {
      const W = window.film.world, L = window.film.layout, res = {};
      W.stations.forEach((s, k) => {
        const seg = L.segments.find((x) => x.name === `idle${k}`);
        W.setFrame(seg.start); W.camera.updateMatrixWorld();
        res[k] = W.anchorsNow(s.anchors.map((a) => a.id));
      });
      return res;
    });
    console.log(variant, JSON.stringify(out));
    await p.close();
  }
} finally { await b.close(); }
