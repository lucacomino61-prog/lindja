// Project world points to screen for a stop: node tools/project.mjs <variant> '{"0":[[x,y,z],...],...}'
import { launch, openFilm } from './probe-frames.mjs';
const [variant, json] = process.argv.slice(2);
const b = await launch();
try {
  const p = await openFilm(b, { w: variant === 'phone' ? 270 : 480, h: variant === 'phone' ? 480 : 270, variant, quality: 'draft' });
  console.log(JSON.stringify(await p.evaluate(async (pts) => {
    const THREE = await import('/node_modules/.vite/deps/three.js').catch(() => null);
    const W = window.film.world, L = window.film.layout, out = {};
    for (const [k, list] of Object.entries(pts)) {
      const seg = L.segments.find((x) => x.name === `idle${k}`);
      W.setFrame(seg.start); W.camera.updateMatrixWorld();
      out[k] = list.map(([x, y, z]) => { const v = W.camera.position.clone().set(x, y, z).project(W.camera); return [+(v.x * 0.5 + 0.5).toFixed(2), +(0.5 - v.y * 0.5).toFixed(2)]; });
    }
    return out;
  }, JSON.parse(json))));
} finally { await b.close(); }
