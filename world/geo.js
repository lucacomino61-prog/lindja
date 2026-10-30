// The relief model's geography: two coasts on one board. Korea's west coast (Incheon) on the east end,
// the open sea in the middle, Albania's coast (Durrës) and Tirana on the west end. Distances are compressed
// (0.268 km per unit, Durrës port to Tirana matched) while the miniatures keep 0.2 units per metre; the land is the
// real relief (open AWS Terrain Tiles, tools/dem.mjs → assets/dem.json), Albania mirrored so its coast faces the sea.
import { simplex2, smoothstep, lerp, clamp } from './noise.js';
import DEM from './assets/dem.json';

export const MAP = { w: 940, d: 420, cell: 1.6 };

// rect = [x0, x1, z0, z1] of a flat working yard; blend = how far the ground eases back to the landform.
// quayX + seaSide: the quay wall line and which side of it is water.
export const STATIONS = [
  { id: 'kore', name: 'Incheon', x: 318, z: -26, pad: 2.4, rect: [286, 352, -58, 4], blend: 18, ground: 'asphalt' },
  { id: 'port', name: 'Incheon', x: 244, z: 30, pad: 0.6, rect: [222, 272, -6, 66], blend: 14, quay: 222, seaSide: -1, ground: 'concrete' },
  { id: 'deti', name: 'Deti', x: 0, z: 6, pad: null },
  { id: 'durres', name: 'Durrës', x: -246, z: 22, pad: 0.6, rect: [-272, -222, -14, 60], blend: 14, quay: -222, seaSide: 1, ground: 'concrete' },
  { id: 'salloni', name: 'Tiranë', x: -336, z: -34, pad: 3.2, rect: [-370, -302, -62, -6], blend: 18, ground: 'concrete' },
];

// Roads: Korea (yard → port), Albania (port → showroom → Tirana).
export const ROAD_K = [[338, 30], [320, 14], [300, 20], [280, 34], [262, 40], [240, 44], [226, 46]];
export const ROAD_A = [[-228, 44], [-252, 46], [-276, 40], [-298, 28], [-312, 8], [-320, -2], [-344, 0], [-372, -6], [-420, -18], [-470, -30]];

const n1 = simplex2(11), n3 = simplex2(37), n4 = simplex2(51);

export const coastK = (z) => 214 + 8 * Math.sin(z * 0.014 + 0.4) + 6 * n4(z * 0.02, 1.7) + 18 * smoothstep(70, 160, Math.abs(z - 20));
export const coastA = (z) => -214 - 8 * Math.sin(z * 0.013 + 1.2) - 6 * n4(z * 0.021, 5.3) - 18 * smoothstep(70, 160, Math.abs(z - 20));
// signed distance inland (negative = sea)
export function inland(x, z) { return x >= 0 ? x - coastK(z) : coastA(z) - x; }

function fbm(f, x, z, oct = 5) { let a = 0.5, s = 0, fr = 1; for (let i = 0; i < oct; i++) { s += a * f(x * fr, z * fr); fr *= 2.03; a *= 0.5; } return s; }

function polyInfo(pts, x, z) {
  let best = Infinity, acc = 0, bestAlong = 0, px = x, pz = z;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) { best = d; bestAlong = acc + t * L; px = ax + dx * t; pz = az + dz * t; }
    acc += L;
  }
  return { d: best, along: bestAlong, px, pz };
}

// real elevation in board units: metres x vertical exaggeration (Korea's gentler hills a little more)
const DEM_SCALE = { albania: 0.022, korea: 0.03 };
function demHeight(x, z) {
  const name = x > 0 ? 'korea' : 'albania', R = DEM.regions[name], n = R.nx, g = R.m;
  const fi = (x - R.x0) / DEM.cell, fj = (z - R.z0) / DEM.cell;
  const i = clamp(Math.floor(fi), 0, R.nx - 2), j = clamp(Math.floor(fj), 0, R.nz - 2), ax = clamp(fi - i, 0, 1), az = clamp(fj - j, 0, 1);
  const h = (g[j * n + i] * (1 - ax) + g[j * n + i + 1] * ax) * (1 - az) + (g[(j + 1) * n + i] * (1 - ax) + g[(j + 1) * n + i + 1] * ax) * az;
  return Math.max(0, h) * DEM_SCALE[name];
}
export function rawHeight(x, z) {
  const d = inland(x, z);
  if (d < 0) return -1.4 + d * 0.06 + 0.5 * n3(x * 0.03, z * 0.03) - 4 * smoothstep(0, 60, -d); // seabed
  // a low coastal plain rising off the beach, the real relief on it, and a little ground texture
  return 1.25 * smoothstep(0, 7, d) + smoothstep(0, 12, d) * demHeight(x, z) + 0.3 * fbm(n1, x * 0.05, z * 0.05, 3);
}

export function height(x, z) {
  let y = rawHeight(x, z);
  for (const road of [ROAD_K, ROAD_A]) {
    const r = polyInfo(road, x, z);
    // the road bed takes the height of the road's centre line, so the ground across the carriageway is level with it
    // (taken at each point instead, a cross-slope lifted the verge through the asphalt)
    if (r.d < 12) y = lerp(y, Math.max(1.2, rawHeight(r.px, r.pz) * 0.55 + 0.9), 1 - smoothstep(2.2, 12, r.d));
  }
  for (const st of STATIONS) {
    if (st.pad == null) continue;
    if (st.quay != null && (x - st.quay) * st.seaSide > 0) {
      // deep water in front of the quay wall
      const dz = Math.max(st.rect[2] - z, 0, z - st.rect[3]);
      const k = 1 - smoothstep(4, st.blend * 1.6, dz + Math.max(0, Math.abs(x - st.quay) - 40));
      y = lerp(y, Math.min(y, -3.6), k);
      continue;
    }
    const d = rectDist(st, x, z);
    if (d >= st.blend) continue;
    y = lerp(y, st.pad, 1 - smoothstep(0, st.blend, d));
  }
  return y;
}

export function rectDist(st, x, z) {
  const [x0, x1, z0, z1] = st.rect;
  return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
}
export function roadInfo(pts, x, z) { return polyInfo(pts, x, z); }
