// Cars and the ships and buildings that move them. Cars are Kenney's Car Kit (CC0, public/models/kenney),
// merged into one geometry per body and repainted per listing; ships, trucks and buildings are built here.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mat, C, wordTexture, shadowed, truck } from './kit.js';
import { rng } from './noise.js';

export const CAR_LENGTH = 0.92; // model units; about 0.52 wide. A truck is about 2.3
export const CAR_COLORS = ['#F2F2EE', '#E4E2DA', '#1B1D21', '#A9AEB3', '#6C7177', '#2D4D78', '#9E2A2B', '#F2F2EE', '#1B1D21', '#A9AEB3', '#4D6A57', '#D9CFBF'];

// body type → Kenney model
const KIT = { sedan: 'sedan', suv: 'suv', lux: 'suv-luxury', ev: 'suv-luxury', hatch: 'hatchback-sports', van: 'van', flat: 'truck-flat' };
let kit = null;

export async function loadKit(base = '/models/kenney/') {
  if (kit) return kit;
  const loader = new GLTFLoader();
  const files = [...new Set(Object.values(KIT))];
  const gltfs = await Promise.all(files.map((f) => loader.loadAsync(`${base}${f}.glb`)));
  kit = {};
  files.forEach((f, i) => {
    const root = gltfs[i].scene;
    root.updateMatrixWorld(true);
    const parts = [];
    let map = null, body = null;
    root.traverse((o) => {
      if (!o.isMesh) return;
      let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      parts.push(g);
      map ||= o.material.map;
      if (/body/i.test(o.name) && (!body || g.attributes.position.count > body.attributes.position.count)) body = g; // wheels can hang under the body node
    });
    const geo = mergeGeometries(parts);
    // face +z, sit on y = 0, centred, length = CAR_LENGTH (trucks keep their own size ratio)
    geo.computeBoundingBox();
    let s = geo.boundingBox.getSize(new THREE.Vector3());
    if (s.x > s.z) { geo.rotateY(Math.PI / 2); geo.computeBoundingBox(); s = geo.boundingBox.getSize(new THREE.Vector3()); }
    const len = f === 'truck-flat' ? 2.3 : f === 'van' ? 1.05 : CAR_LENGTH;
    const k = len / s.z;
    const kx = f === 'truck-flat' ? 0.8 / s.x : k; // the cartoon truck is slimmed to fit a lane
    const c = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-c.x, -geo.boundingBox.min.y, -c.z);
    geo.scale(kx, k, k);
    if (FLIP[f]) geo.rotateY(Math.PI);
    geo.computeVertexNormals();
    kit[f] = { geo, map, paint: paintKey(body || parts[0], map, f), size: new THREE.Vector3(s.x * kx, s.y * k, s.z * k) };
  });
  if (typeof window !== 'undefined') window.__paint = Object.fromEntries(Object.entries(kit).map(([k, v]) => [k, v.paint.family.map((c) => [c.cx, c.cy, Math.round(c.h), +c.s.toFixed(2), +c.v.toFixed(2)])]));
  return kit;
}
// Kenney's cars are modelled nose to -z; turn them so the nose is +z like every other vehicle here
const FLIP = { sedan: true, suv: true, 'suv-luxury': true, 'hatchback-sports': true, van: true, 'truck-flat': true };

// Kenney's colormap is a grid of gradient swatches (16 columns x 4 rows on 512 px). The body paint is the
// swatch cell the body mesh uses most by area; its neighbours of the same hue are the paint's darker side.
const COLS = 16, ROWS = 4;
const hueSat = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; }
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255];
};
// each Kenney model ships one body colour; its hue says which swatch cells are paint
const PAINT_HUE = { sedan: 8, suv: 150, 'suv-luxury': 40, 'hatchback-sports': 150, van: 222, 'truck-flat': null };
function paintKey(geo, map, file) {
  const img = map.image;
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const W = cv.width, H = cv.height, px = g.getImageData(0, 0, W, H).data;
  const cw = W / COLS, ch = H / ROWS;
  const cells = [];
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = cy * ch; y < (cy + 1) * ch; y += 4) for (let x = cx * cw; x < (cx + 1) * cw; x += 4) { const o = (y * W + x) * 4; r += px[o]; gg += px[o + 1]; b += px[o + 2]; n++; }
    r /= n; gg /= n; b /= n;
    const [h, sat, v] = hueSat(r, gg, b);
    cells.push({ cx, cy, h, s: sat, v, lum: 0.299 * r + 0.587 * gg + 0.114 * b });
  }
  // cells the body actually uses
  const used = new Set();
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) used.add(Math.min(ROWS - 1, Math.max(0, Math.floor(uv.getY(i) * ROWS))) * COLS + Math.min(COLS - 1, Math.max(0, Math.floor(uv.getX(i) * COLS))));
  const hue = PAINT_HUE[file];
  const family = hue == null ? [] : [...used].map((k) => cells[k]).filter((c) => c.s > 0.35 && Math.min(Math.abs(c.h - hue), 360 - Math.abs(c.h - hue)) < 18);
  const lum = family.length ? family.reduce((t, c) => t + c.lum, 0) / family.length : 200;
  if (typeof window !== 'undefined') (window.__used ||= {})[file] = [...used].map((k) => [cells[k].cx, cells[k].cy, Math.round(cells[k].h), +cells[k].s.toFixed(2), +cells[k].v.toFixed(2)]);
  return { px, w: W, h: H, cw, ch, family, lum };
}

function paintedMaterial(file, color) {
  const key = `${file}|${color}`;
  if (paintCache.has(key)) return paintCache.get(key);
  const { paint, map } = kit[file];
  const cv = document.createElement('canvas'); cv.width = paint.w; cv.height = paint.h;
  const g = cv.getContext('2d');
  const out = g.createImageData(paint.w, paint.h);
  out.data.set(paint.px);
  const t = new THREE.Color(color);
  const tr = t.r * 255, tg = t.g * 255, tb = t.b * 255;
  const d = out.data;
  for (const cell of paint.family) {
    for (let y = cell.cy * paint.ch; y < (cell.cy + 1) * paint.ch; y++) for (let x = cell.cx * paint.cw; x < (cell.cx + 1) * paint.cw; x++) {
      const o = (y * paint.w + x) * 4;
      // keep the swatch's own gradient: scale the new colour by the pixel's brightness against the paint's mean
      const f = Math.min(1.6, (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / Math.max(1, paint.lum));
      d[o] = Math.min(255, tr * f + (f > 1 ? (f - 1) * 60 : 0)); d[o + 1] = Math.min(255, tg * f + (f > 1 ? (f - 1) * 60 : 0)); d[o + 2] = Math.min(255, tb * f + (f > 1 ? (f - 1) * 60 : 0));
    }
  }
  g.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = map.flipY;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0.1 });
  paintCache.set(key, m);
  return m;
}
const paintCache = new Map();
export function carGeo(type) { return kit[KIT[type] || type].geo; }

export function car(type = 'sedan', color = CAR_COLORS[0]) {
  const file = KIT[type] || type;
  const m = new THREE.Mesh(kit[file].geo, paintedMaterial(file, color));
  m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m);
  g.userData.type = type;
  return g;
}
// many parked cars: one InstancedMesh per body and colour. slots [{x,y,z,ry,type,color}]
export function carLot(slots) {
  const g = new THREE.Group();
  const groups = new Map();
  for (const s of slots) { const k = `${KIT[s.type] || s.type}|${s.color}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), e = new THREE.Euler();
  for (const [k, list] of groups) {
    const [file, color] = k.split('|');
    const im = new THREE.InstancedMesh(kit[file].geo, paintedMaterial(file, color), list.length);
    list.forEach((s, i) => { p.set(s.x, s.y, s.z); q.setFromEuler(e.set(0, s.ry || 0, 0)); m4.compose(p, q, one); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true;
    g.add(im);
  }
  return g;
}
export function lotSlots({ x0, z0, rows, cols, dx = 0.46, dz = 1.05, y = 0, ry = 0, seed = 1, gapEvery = 0, fill = 0.92, types = ['sedan', 'suv', 'suv', 'hatch', 'ev'] }) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if (r() > fill) continue;
    const zz = z0 + j * dz + (gapEvery && j >= gapEvery ? 1.2 * Math.floor(j / gapEvery) : 0);
    out.push({ x: x0 + i * dx, y, z: zz, ry: ry + (r() < 0.5 ? 0 : Math.PI), type: types[Math.floor(r() * types.length)], color: CAR_COLORS[Math.floor(r() * CAR_COLORS.length)] });
  }
  return out;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function m(geo, material, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; }
function decal(tex, w, h, transparent = false) {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, transparent, polygonOffset: true, polygonOffsetFactor: -2 }));
  o.receiveShadow = true; return o;
}

// Pure car and truck carrier (PCTC), nose +z: dark hull with a flared bow, white car decks with louvres,
// a bridge across the bow with wings and a turning radar, funnel and free-fall lifeboat aft, stern quarter ramp.
export function carCarrier({ len = 34, name = 'LINDJA' } = {}) {
  const g = new THREE.Group();
  const w = 5.6, hHull = 7.2;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, -len / 2); sh.lineTo(w / 2, -len / 2); sh.lineTo(w / 2, len / 2 - 4.2); sh.bezierCurveTo(w / 2, len / 2 - 1.2, w * 0.18, len / 2 + 0.5, 0, len / 2 + 0.6); sh.bezierCurveTo(-w * 0.18, len / 2 + 0.5, -w / 2, len / 2 - 1.2, -w / 2, len / 2 - 4.2); sh.closePath();
  const ext = (depth, y0, color, s = 1, bevel = 0) => { const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 18 }); geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI); geo.scale(s, 1, s); geo.translate(0, y0, 0); return m(geo, mat(color, { roughness: 0.55 })); };
  g.add(ext(1.0, -1.25, '#7A2A22')); // red bottom below the waterline
  g.add(ext(1.25, -0.25, C.ink));
  g.add(ext(0.28, 0.98, C.orange, 1.003));
  g.add(ext(hHull - 1.45, 1.24, C.white, 1, 0.06));
  // deck lines and louvres on both sides
  const louvre = mat('#9EA3A6', { roughness: 0.8 });
  for (const side of [-1, 1]) {
    for (const yy of [2.6, 3.8, 5.0, 6.2]) g.add(m(box(0.02, 0.05, len - 6), mat('#CFD1CB'), side * (w / 2 + 0.065), yy, -1.2));
    for (let i = 0; i < 12; i++) for (const yy of [3.2, 5.6]) g.add(m(box(0.03, 0.36, 0.9), louvre, side * (w / 2 + 0.07), yy, -len / 2 + 3 + i * 2.3));
  }
  g.add(m(box(w * 0.98, 0.16, len - 3), mat('#B9BBB5'), 0, hHull - 0.2, -0.8)); // weather deck
  for (let i = 0; i < 9; i++) for (const side of [-1, 1]) g.add(m(box(0.1, 0.36, 0.5), mat('#C4C6C1'), side * (w / 2 - 0.25), hHull + 0.08, -len / 2 + 4 + i * 2.8));
  // bridge forward: window band all round, wings, mast with radar
  const bz = len / 2 - 5.2;
  g.add(m(box(w - 0.2, 1.3, 2.0), mat(C.white), 0, hHull + 0.55, bz));
  g.add(m(box(w - 0.18, 0.34, 2.02), mat('#1C2A33', { roughness: 0.15, metalness: 0.3 }), 0, hHull + 0.78, bz));
  g.add(m(box(w + 1.4, 0.16, 1.1), mat(C.white), 0, hHull + 1.12, bz + 0.3));
  g.add(m(box(w + 0.4, 0.14, 2.2), mat(C.ink), 0, hHull + 1.27, bz));
  const mast = new THREE.Group(); mast.position.set(0, hHull + 1.34, bz - 0.3);
  mast.add(m(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 6), mat(C.white), 0, 0.9, 0));
  mast.add(m(box(0.7, 0.06, 0.06), mat(C.white), 0, 1.4, 0));
  const radar = new THREE.Group(); radar.position.set(0, 1.85, 0);
  radar.add(m(box(1.1, 0.06, 0.1), mat(C.dark), 0, 0, 0));
  radar.add(m(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6), mat(C.dark), 0, -0.07, 0));
  mast.add(radar);
  const beacon = m(new THREE.SphereGeometry(0.07, 8, 6), mat('#FFE9A8', { emissive: '#FFD86A', emissiveIntensity: 1 }), 0, 2.0, 0); mast.add(beacon);
  g.add(mast);
  // forecastle winches
  for (const x of [-1.2, 1.2]) { const wch = m(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 10), mat(C.dark), x, hHull + 0.15, len / 2 - 1.8); wch.rotation.z = Math.PI / 2; g.add(wch); }
  // funnel aft with the brand band
  g.add(m(box(1.1, 1.7, 1.1), mat(C.ink), 0, hHull + 0.85, -len / 2 + 2.6));
  g.add(m(box(1.12, 0.38, 1.12), mat(C.orange), 0, hHull + 1.25, -len / 2 + 2.6));
  // free-fall lifeboat on its slipway
  const lb = new THREE.Group(); lb.position.set(0, hHull + 0.55, -len / 2 + 0.6); lb.rotation.x = 0.5;
  lb.add(m(new THREE.CapsuleGeometry(0.32, 1.4, 4, 8).rotateX(Math.PI / 2), mat('#F2702A'), 0, 0, 0));
  lb.add(m(box(0.5, 0.18, 0.7), mat('#F2702A'), 0, 0.32, -0.2));
  g.add(lb);
  // stern quarter ramp, hinged at the stern; setRamp lowers it
  const rampPivot = new THREE.Group(); rampPivot.position.set(-(w / 2 - 0.9), 0.95, -len / 2); rampPivot.rotation.order = 'YXZ';
  const ramp = m(box(1.5, 0.12, 4.2), mat(C.dark), 0, 0, -2.1); rampPivot.add(ramp);
  for (const x of [-0.7, 0.7]) rampPivot.add(m(box(0.06, 0.2, 4.2), mat(C.yellow), x, 0.1, -2.1));
  g.add(rampPivot);
  const tex = wordTexture(name, { bg: C.white, fg: C.ink, w: 2048, h: 320, font: '800 270px "Big Shoulders Display"', tracking: 10 });
  for (const side of [1, -1]) { const d = decal(tex, 16, 2.5); d.position.set(side * (w / 2 + 0.072), 4.4, -2.4); d.rotation.y = side * Math.PI / 2; g.add(d); }
  g.userData = { rampPivot, radar, len, w };
  return shadowed(g);
}
export function setRamp(ship, k) { ship.userData.rampPivot.rotation.set(-0.09 * k - 1.35 * (1 - k), 0.6 * k, 0); }
export function spinRadar(ship, phase) { ship.userData.radar.rotation.y = phase * Math.PI * 2; }

// car transporter: Kenney's flatbed truck carrying a two-deck frame with four cars
export function carTransporter(seed = 1) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(kit['truck-flat'].geo, paintedMaterial('truck-flat', '#F2F2EE')); base.castShadow = true; base.receiveShadow = true; g.add(base);
  const r = rng(seed);
  const frame = mat('#3A3F45');
  const L = kit['truck-flat'].size.z, bedY = kit['truck-flat'].size.y * 0.42, bedZ = -L * 0.12;
  g.add(m(box(0.62, 0.04, L * 0.62), frame, 0, bedY + 0.48, bedZ));
  for (const z of [bedZ - L * 0.3, bedZ, bedZ + L * 0.3]) for (const x of [-0.29, 0.29]) g.add(m(box(0.05, 0.5, 0.05), frame, x, bedY + 0.24, z));
  const types = ['sedan', 'suv', 'hatch', 'ev'];
  for (const [z, y] of [[bedZ + L * 0.16, bedY], [bedZ - L * 0.16, bedY], [bedZ + L * 0.16, bedY + 0.5], [bedZ - L * 0.16, bedY + 0.5]]) {
    const c = car(types[Math.floor(r() * 4)], CAR_COLORS[Math.floor(r() * CAR_COLORS.length)]);
    c.scale.setScalar(0.74); c.position.set(0, y + 0.02, z); g.add(c);
  }
  return shadowed(g);
}

// glass showroom: plinth, double-height glazing with mullions, folded roof cantilevered over the entrance,
// lit sign, podiums inside, spotlights; userData.podium (the one that turns)
export function showroom({ w = 16, d = 8, h = 3.6 } = {}) {
  const g = new THREE.Group();
  g.add(m(box(w + 1.6, 0.25, d + 3.2), mat('#2A2E33', { roughness: 0.7 }), 0, 0.12, 1)); // plinth
  g.add(m(box(w, 0.06, d), mat('#F4F2ED', { roughness: 0.18, metalness: 0.05, emissive: '#F4F2ED', emissiveIntensity: 0.12 }), 0, 0.28, 0)); // polished floor
  const glass = new THREE.MeshStandardMaterial({ color: '#CFE2EA', roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.16, depthWrite: false });
  for (const [x, z, ww, dd] of [[0, d / 2, w, 0.05], [-w / 2, 0, 0.05, d], [w / 2, 0, 0.05, d]]) { const p = new THREE.Mesh(box(ww, h, dd), glass); p.position.set(x, 0.25 + h / 2, z); g.add(p); }
  g.add(m(box(w, h, 0.25), mat('#E9E6DF'), 0, 0.25 + h / 2, -d / 2)); // back wall
  const mull = mat('#1A1D21', { roughness: 0.4, metalness: 0.4 });
  for (let i = 0; i <= 8; i++) g.add(m(box(0.07, h, 0.07), mull, -w / 2 + (w * i) / 8, 0.25 + h / 2, d / 2));
  g.add(m(box(w, 0.07, 0.07), mull, 0, 0.25 + h * 0.52, d / 2));
  // folded roof: a thin slab that rises toward the entrance corner
  const roof = new THREE.Group();
  const slab = m(box(w + 2.4, 0.32, d + 3.2), mat(C.white, { roughness: 0.5 }), 0, 0, 1.3); roof.add(slab);
  roof.add(m(box(w + 2.42, 0.1, 0.06), mat(C.orange), 0, -0.12, d / 2 + 2.92));
  roof.position.set(0, 0.25 + h + 0.18, 0); roof.rotation.x = -0.04;
  g.add(roof);
  for (const [x, z] of [[-w / 2 - 0.8, d / 2 + 2.4], [w / 2 + 0.8, d / 2 + 2.4]]) g.add(m(new THREE.CylinderGeometry(0.09, 0.09, h + 0.4, 8), mull, x, 0.25 + h / 2 + 0.2, z));
  // sign on the roof edge
  const tex = wordTexture('lindja', { bg: null, fg: C.orange, w: 1536, h: 256, font: '800 230px "Big Shoulders Display"' });
  const s = decal(tex, 5.2, 0.87, true); s.material.emissive = new THREE.Color(C.orange); s.material.emissiveMap = tex; s.material.emissiveIntensity = 0.55;
  s.position.set(-w / 2 + 3.4, 0.25 + h + 0.62, d / 2 + 2.95); g.add(s);
  // podiums and spotlights inside
  const podMat = mat('#DCD8D0', { roughness: 0.25 });
  const pods = [];
  for (let i = 0; i < 4; i++) { const p = m(new THREE.CylinderGeometry(1.0, 1.05, 0.14, 32), podMat, -w / 2 + 2.6 + i * 3.6, 0.37, 0.9); g.add(p); pods.push(p.position.clone()); }
  const spot = mat('#FFF6E0', { emissive: '#FFF1CF', emissiveIntensity: 1.2 });
  for (let i = 0; i < 8; i++) g.add(m(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10), spot, -w / 2 + 1.2 + i * 1.9, 0.25 + h - 0.05, 0.6));
  for (const [x, z, it] of [[-w / 4, 0.8, 16], [w / 4, 0.8, 16]]) { const l = new THREE.PointLight('#FFF4E2', it, 14, 1.6); l.position.set(x, 0.25 + h - 0.6, z); g.add(l); }
  g.add(m(box(2.2, 0.9, 0.7), mat(C.ink), w / 2 - 2.0, 0.7, -d / 2 + 1.2)); // reception desk
  g.add(m(box(2.24, 0.06, 0.74), mat(C.orange), w / 2 - 2.0, 1.17, -d / 2 + 1.2));
  g.userData = { w, d, h, pods, floorY: 0.44 };
  return shadowed(g);
}

// Korean gate with an upturned tiled roof (dancheong colours), for the Incheon yard entrance
export function koreanGate(width = 5) {
  const g = new THREE.Group();
  const post = mat('#8A3B2C'), beam = mat('#3E7A6A'), tile = mat('#3B4046', { roughness: 0.7 });
  for (const x of [-width / 2 + 0.3, width / 2 - 0.3]) g.add(m(new THREE.CylinderGeometry(0.14, 0.16, 2.2, 8), post, x, 1.1, 0));
  g.add(m(box(width - 0.2, 0.22, 0.34), beam, 0, 2.15, 0));
  const sh = new THREE.Shape();
  sh.moveTo(-1.0, 0); sh.quadraticCurveTo(-0.55, 0.12, -0.3, 0.55); sh.lineTo(0.3, 0.55); sh.quadraticCurveTo(0.55, 0.12, 1.0, 0); sh.lineTo(1.08, 0.12); sh.quadraticCurveTo(0.6, 0.3, 0.36, 0.78); sh.lineTo(-0.36, 0.78); sh.quadraticCurveTo(-0.6, 0.3, -1.08, 0.12); sh.closePath();
  const roof = new THREE.ExtrudeGeometry(sh, { depth: width + 0.9, bevelEnabled: false });
  roof.rotateY(Math.PI / 2); roof.translate(-(width + 0.9) / 2, 2.26, 0);
  g.add(m(roof, tile));
  return shadowed(g);
}
// Korean apartment slabs with block numbers, the skyline behind Incheon
export function apartmentBlocks(points) {
  const g = new THREE.Group();
  const r = rng(31);
  for (const [i, p] of points.entries()) {
    const fl = 14 + Math.floor(r() * 12), h = fl * 0.42;
    const b = m(box(3.4, h, 1.1), mat(C.white), 0, h / 2, 0);
    const o = new THREE.Group(); o.add(b);
    for (let k = 0; k < fl; k += 1) o.add(m(box(3.42, 0.05, 1.12), mat('#C9CDD0'), 0, 0.42 * k + 0.2, 0));
    const tex = wordTexture(String(101 + i), { bg: null, fg: '#3E6FA8', w: 512, h: 256, font: '700 200px "Big Shoulders Display"' });
    const d = decal(tex, 1.2, 0.6, true); d.position.set(0, h - 0.6, 0.56); o.add(d);
    o.position.set(p.x, p.y, p.z); o.rotation.y = p.ry || 0;
    g.add(shadowed(o));
  }
  return g;
}
export function lighthouseIslet() {
  const g = new THREE.Group();
  const rock = m(new THREE.IcosahedronGeometry(3.2, 1), mat('#9C978D', { roughness: 0.95 }), 0, -0.6, 0); rock.scale.set(1.4, 0.55, 1.1); g.add(rock);
  const r2 = m(new THREE.IcosahedronGeometry(1.8, 0), mat('#8E897F'), 2.6, -0.4, 1.4); r2.scale.set(1, 0.5, 1); g.add(r2);
  g.add(m(new THREE.CylinderGeometry(0.34, 0.46, 3.0, 10), mat(C.white), 0, 2.2, 0));
  g.add(m(new THREE.CylinderGeometry(0.47, 0.47, 0.5, 10), mat('#C8352B'), 0, 1.3, 0));
  g.add(m(new THREE.CylinderGeometry(0.3, 0.3, 0.45, 10), mat('#FFF3C9', { emissive: '#FFE08A', emissiveIntensity: 0.6 }), 0, 3.9, 0));
  g.add(m(new THREE.ConeGeometry(0.42, 0.45, 10), mat('#C8352B'), 0, 4.35, 0));
  return shadowed(g);
}
export function foam(len = 10, w = 3) {
  // low-poly wake: flat white shards in a widening V behind the stern; children carry a phase for pulsing
  const g = new THREE.Group();
  const r = rng(17);
  const fm = mat('#F2F7F6', { roughness: 0.55 });
  for (let i = 0; i < 70; i++) {
    const t = r(), side = r() < 0.5 ? -1 : 1;
    const spread = w / 2 + t * len * 0.32;
    const x = side * spread * (0.75 + r() * 0.35), z = -t * len;
    const s = (0.25 + r() * 0.5) * (1 - t * 0.6);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(s, 5), fm);
    sh.rotation.x = -Math.PI / 2; sh.rotation.z = r() * 6; sh.position.set(x, 0.12, z);
    sh.userData.ph = r() * 6.28; sh.userData.base = s; sh.receiveShadow = true;
    g.add(sh);
  }
  return g;
}
export function gull() {
  const g = new THREE.Group();
  const wm = mat('#FFFFFF');
  for (const s of [-1, 1]) { const wgt = m(box(0.5, 0.02, 0.12), wm, s * 0.24, 0, 0); wgt.rotation.z = s * 0.35; g.add(wgt); }
  return g;
}
export function priceBoard() {
  const g = new THREE.Group();
  g.add(m(box(0.03, 0.3, 0.03), mat(C.dark), 0, 0.15, 0));
  g.add(m(box(0.32, 0.2, 0.02), mat(C.white), 0, 0.38, 0));
  g.add(m(box(0.32, 0.05, 0.022), mat(C.orange), 0, 0.46, 0));
  return g;
}
