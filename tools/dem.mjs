// Real relief for the board from the open AWS Terrain Tiles (Terrarium PNG, elevation = R*256 + G + B/256 - 32768 m).
// The board compresses distance: 0.268 km per unit, matched on Durrës port → Tirana; Albania is mirrored east-west
// (its coast faces the board's open sea on +x), Korea is not. Writes world/assets/dem.json: two grids of metres
// sampled every MAP.cell over each coast's land side, read synchronously by world/geo.js.
// usage: node tools/dem.mjs   (needs the network)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = path.resolve(import.meta.dirname, '..');
const KM = 0.268, Z = 10, CELL = 1.6, D = 420;
// board x,z → lon,lat (deg)
const REGIONS = {
  albania: { x0: -480, x1: -200, toLL: (x, z) => [19.452 + ((-222 - x) * KM) / (111.32 * Math.cos((41.31 * Math.PI) / 180)), 41.312 - ((z - 22) * KM) / 111.0] },
  korea: { x0: 200, x1: 480, toLL: (x, z) => [126.616 + ((x - 222) * KM) / (111.32 * Math.cos((37.46 * Math.PI) / 180)), 37.46 - ((z - 30) * KM) / 111.0] },
};
const tileXY = (lon, lat) => { const n = 2 ** Z, r = (lat * Math.PI) / 180; return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n]; };
const cache = new Map();
async function tile(tx, ty) {
  const k = `${tx}/${ty}`;
  if (cache.has(k)) return cache.get(k);
  let buf;
  for (let i = 0; i < 4; i++) { try { const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`); if (!r.ok) throw new Error(r.status); buf = Buffer.from(await r.arrayBuffer()); break; } catch (e) { if (i === 3) throw e; await new Promise((s) => setTimeout(s, 1500)); } }
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const t = { data, w: info.width };
  cache.set(k, t);
  return t;
}
async function elev(lon, lat) { // bilinear over the tile pixels
  const [fx, fy] = tileXY(lon, lat), px = fx * 256 - 0.5, py = fy * 256 - 0.5;
  const x0 = Math.floor(px), y0 = Math.floor(py), ax = px - x0, ay = py - y0;
  const at = async (X, Y) => { const t = await tile(Math.floor(X / 256), Math.floor(Y / 256)), i = ((Y % 256) * t.w + (X % 256)) * 3; return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768; };
  const [a, b, c, d] = await Promise.all([at(x0, y0), at(x0 + 1, y0), at(x0, y0 + 1), at(x0 + 1, y0 + 1)]);
  return (a * (1 - ax) + b * ax) * (1 - ay) + (c * (1 - ax) + d * ax) * ay;
}
const out = { km: KM, cell: CELL, regions: {} };
for (const [name, R] of Object.entries(REGIONS)) {
  const nx = Math.round((R.x1 - R.x0) / CELL) + 1, nz = Math.round(D / CELL) + 1, grid = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) grid.push(Math.round(await elev(...R.toLL(R.x0 + i * CELL, -D / 2 + j * CELL))));
  out.regions[name] = { x0: R.x0, z0: -D / 2, nx, nz, m: grid };
  console.log(name, `${nx}x${nz}`, 'min', Math.min(...grid), 'max', Math.max(...grid), 'tiles so far', cache.size);
}
fs.writeFileSync(path.join(root, 'world/assets/dem.json'), JSON.stringify(out));
console.log('wrote world/assets/dem.json', (fs.statSync(path.join(root, 'world/assets/dem.json')).size / 1e6).toFixed(2), 'MB');
