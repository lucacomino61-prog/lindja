// The relief model's geography: two coasts on one board. Korea's west coast (Incheon) on the east end,
// the open sea in the middle, Albania's coast (Durrës) and Tirana on the west end. The board is a
// stylised diorama, not a map: distances are compressed, miniatures are not.
import { simplex2, smoothstep, lerp, clamp } from './noise.js';

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

const n1 = simplex2(11), n2 = simplex2(23), n3 = simplex2(37), n4 = simplex2(51);

export const coastK = (z) => 214 + 8 * Math.sin(z * 0.014 + 0.4) + 6 * n4(z * 0.02, 1.7) + 18 * smoothstep(70, 160, Math.abs(z - 20));
export const coastA = (z) => -214 - 8 * Math.sin(z * 0.013 + 1.2) - 6 * n4(z * 0.021, 5.3) - 18 * smoothstep(70, 160, Math.abs(z - 20));
// signed distance inland (negative = sea)
export function inland(x, z) { return x >= 0 ? x - coastK(z) : coastA(z) - x; }

function fbm(f, x, z, oct = 5) { let a = 0.5, s = 0, fr = 1; for (let i = 0; i < oct; i++) { s += a * f(x * fr, z * fr); fr *= 2.03; a *= 0.5; } return s; }
function ridged(x, z) { let a = 0.55, s = 0, fr = 1; for (let i = 0; i < 5; i++) { const v = 1 - Math.abs(n2(x * fr, z * fr)); s += a * v * v; fr *= 2.1; a *= 0.5; } return s; }

function polyInfo(pts, x, z) {
  let best = Infinity, acc = 0, bestAlong = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) { best = d; bestAlong = acc + t * L; }
    acc += L;
  }
  return { d: best, along: bestAlong };
}

export function rawHeight(x, z) {
  const d = inland(x, z);
  if (d < 0) return -1.4 + d * 0.06 + 0.5 * n3(x * 0.03, z * 0.03) - 4 * smoothstep(0, 60, -d); // seabed
  const korea = x > 0;
  const plain = 0.5 + 1.5 * smoothstep(0, 70, d) + 0.5 * fbm(n1, x * 0.02, z * 0.02, 3);
  const hills = smoothstep(14, 110, d) * (4 + 7 * fbm(n1, x * 0.013 + (korea ? 7 : 0), z * 0.013, 4));
  // Korea: granite ranges close behind the coast; Albania: the hills and Dajti behind Tirana
  const mount = smoothstep(korea ? 90 : 120, korea ? 200 : 230, d) * (korea ? 52 : 46) * Math.pow(ridged(x * 0.009 + (korea ? 3 : 9), z * 0.009 - 3), 1.7);
  return plain + hills + mount;
}

export function height(x, z) {
  let y = rawHeight(x, z);
  for (const road of [ROAD_K, ROAD_A]) {
    const r = polyInfo(road, x, z);
    if (r.d < 12) y = lerp(y, Math.max(1.2, rawHeight(x, z) * 0.55 + 0.9), 1 - smoothstep(2.2, 12, r.d));
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
