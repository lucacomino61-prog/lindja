// Real models from Sketchfab (CC-BY; authors in public/models/sketchfab/CREDITS.txt, credited in the site footer),
// downloaded by tools/sketchfab.mjs and slimmed by tools/optimize-models.mjs. Every car comes twice: full detail
// for close shots and catalogue stills, and a ~6,000-triangle copy for the parked rows.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = '/models/sketchfab/';
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const scene = (file) => loader.loadAsync(`${BASE}${file}.glb`).then((g) => g.scene);

export const METRE = 0.2; // model units per metre: a 4.6 m car is CAR_LENGTH (0.92)

// body type → model, the material that carries the paint, real length, and whether the nose points to -z
export const CAR_MODELS = {
  sedan: { file: 'car-sedan', paint: /^Paint$/, m: 4.86, flip: false }, // 2017 Hyundai Sonata Hybrid
  hatch: { file: 'car-hatch', paint: /^carpaint$/, m: 4.34, flip: false }, // 2018 Hyundai i30 N
  suv: { file: 'car-suv', paint: /^varnish$/, m: 4.48, flip: false }, // 2015 Hyundai Tucson
  ev: { file: 'car-ev', paint: /^M_Gravity_Gold_Matte$/, m: 4.64, flip: false }, // Hyundai Ioniq 5
};
// road traffic "vans" are Tucsons (the free Kia Carnival came with its doors open); test-drive "lux" cars are Sonatas
// (the free SsangYong Rexton shares one material between body and tyres)
const ALIAS = { van: 'suv', lux: 'sedan' };

// ---------- materials ----------
const paintCache = new Map();
export function paintMaterial(color) {
  if (paintCache.has(color)) return paintCache.get(color);
  const c = new THREE.Color(color);
  const light = c.getHSL({}).l > 0.6;
  const m = new THREE.MeshPhysicalMaterial({ color: c, metalness: light ? 0.25 : 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
  paintCache.set(color, m);
  return m;
}
const glass = new THREE.MeshPhysicalMaterial({ color: '#0E1419', metalness: 0, roughness: 0.03, transparent: true, opacity: 0.82, envMapIntensity: 1.4 });
const LIGHTS = [
  [/brake|break|tail|rear.?light|backlight.*red/i, '#B3121B'],
  [/indicator|blinker|turn/i, '#E8830C'],
  [/revlight|reverse|fog|front.?lamp|head|rearlights_white/i, '#E9EDEF'],
];
// tidy one source material: real glass, real chrome, plausible light lenses, nothing perfectly matte
function tidy(m) {
  const n = m.name || '';
  if (m.transparent && !m.map) return glass;
  if (/glass|window|windshield/i.test(n) && !m.map) return glass;
  for (const [re, col] of LIGHTS) if (re.test(n)) return new THREE.MeshStandardMaterial({ color: col, roughness: 0.2, metalness: 0.1, emissive: col, emissiveIntensity: 0.15 });
  const out = m.clone();
  if (/chrome|rim|metal(?!_dark)|alu/i.test(n)) { out.metalness = 1; out.roughness = 0.22; }
  else if (/rubber|tire|tyre/i.test(n)) { out.metalness = 0; out.roughness = 0.88; }
  else out.roughness = Math.min(out.roughness, 0.7);
  // textured "transparent" atlases (whole bodies exported with BLEND) render solid; only faint decals stay see-through
  if (out.transparent && out.map) { if (out.opacity >= 0.5) { out.transparent = false; out.depthWrite = true; } else out.depthWrite = false; }
  return out;
}

// ---------- geometry ----------
// meshopt files store quantised integer attributes: back to plain floats before any transform or merge
function floats(geo) {
  const g = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(geo.attributes)) {
    const n = a.count, s = a.itemSize, out = new Float32Array(n * s);
    const get = [a.getX, a.getY, a.getZ, a.getW];
    for (let i = 0; i < n; i++) for (let j = 0; j < s; j++) out[i * s + j] = get[j].call(a, i);
    g.setAttribute(k, new THREE.BufferAttribute(out, s));
  }
  if (geo.index) g.setIndex(Array.from(geo.index.array));
  return g;
}
// every mesh baked into the root's space and merged per material: [{ geo, material }]
function bake(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    let g = floats(o.geometry).applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals(); // the light copies ship without normals: smooth ones, while still indexed
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const m = mats[0];
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m).push(g);
  });
  return [...groups].map(([material, list]) => {
    if (list.some((g) => !g.attributes.uv)) for (const g of list) g.deleteAttribute('uv');
    return { geo: mergeGeometries(list), material };
  });
}
// face +z, wheels on y = 0, centred, `len` long; `box` overrides the parts' own bounds. Returns the size and the
// matrix used, so points measured on the source (the trailer's car slots) can follow
function normalise(parts, len, flip, box = null) {
  if (!box) { box = new THREE.Box3(); for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); } }
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const turn = s.x > s.z, k = len / (turn ? s.x : s.z);
  const m = new THREE.Matrix4().makeScale(k, k, k)
    .multiply(new THREE.Matrix4().makeRotationY((turn ? Math.PI / 2 : 0) + (flip ? Math.PI : 0)))
    .multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
  for (const p of parts) { p.geo.applyMatrix4(m); p.geo.computeBoundingBox(); p.geo.computeBoundingSphere(); }
  return { size: new THREE.Vector3(turn ? s.z : s.x, s.y, turn ? s.x : s.z).multiplyScalar(k), matrix: m };
}
// the light copy: paint, glass and textured parts stay apart, everything else becomes one vertex-coloured mesh
function collapse(parts) {
  const keep = [], rest = [];
  for (const p of parts) {
    if (p.paint || p.material === glass || p.material.map) { keep.push(p); continue; }
    const g = p.geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    const col = p.material.color || new THREE.Color('#222');
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    rest.push({ g, metal: p.material.metalness > 0.6 });
  }
  const glassParts = keep.filter((p) => p.material === glass);
  const merged = [];
  if (glassParts.length > 1) { merged.push({ geo: mergeGeometries(glassParts.map((p) => p.geo)), material: glass }); }
  else merged.push(...glassParts);
  for (const metal of [false, true]) {
    const list = rest.filter((r) => r.metal === metal).map((r) => r.g);
    if (list.length) merged.push({ geo: mergeGeometries(list), material: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: metal ? 1 : 0.1, roughness: metal ? 0.25 : 0.55 }) });
  }
  return [...keep.filter((p) => p.material !== glass), ...merged];
}

export const cars = {};
async function loadCar(type) {
  const cfg = CAR_MODELS[type];
  const [hiRoot, loRoot] = await Promise.all([scene(cfg.file), scene(`${cfg.file}-lo`)]);
  const len = cfg.m * METRE;
  const prep = (root) => noGround(bake(root))
    .filter((p) => !(p.material.transparent && p.material.opacity < 0.05)) // invisible in the source: helper geometry
    .map((p) => {
      const name = p.material.name || '';
      if (cfg.paint.test(name)) return { ...p, paint: true };
      const material = tidy(p.material);
      if (cfg.tint?.[name]) { material.color.set(cfg.tint[name]); material.metalness = 0.85; material.roughness = 0.35; }
      return { geo: p.geo, material };
    });
  const hi = prep(hiRoot), lo = prep(loRoot);
  const { size } = normalise(hi, len, cfg.flip);
  normalise(lo, len, cfg.flip);
  if (!hi.some((p) => p.paint)) console.warn(`[models] ${type}: no paint material matched`);
  cars[type] = { hi, lo: collapse(lo), size };
}
// some exports carry a flat shadow card under the car: drop flat parts lying on the ground
function noGround(parts) {
  const box = new THREE.Box3(), b = new THREE.Box3();
  for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
  const H = box.max.y - box.min.y;
  return parts.filter((p) => { b.copy(p.geo.boundingBox); return !(b.max.y - b.min.y < H * 0.015 && b.min.y - box.min.y < H * 0.02); });
}

// ---------- car transporter ----------
// "Car Transport Trailer" ships loaded with six Skoda Fabias; they come off and our cars go on the same slots,
// measured from the Fabias (k-means on their vertices): fractions of the raw bounds, x along the length with the
// hitch at 1, y up; pitch in radians, nose up toward the hitch
const TRAILER_SLOTS = [[0.515, 0.202, -0.0555], [0.1686, 0.23, 0.1031], [0.8403, 0.3291, 0.0074], [0.1598, 0.5928, 0.0371], [0.5054, 0.6407, 0.0384], [0.8398, 0.6876, 0.0384]];
const SLOT_LEN = 0.309; // a Fabia is this share of the trailer's length
export let transporter = null;
async function loadTransporter() {
  const [tr, cab] = await Promise.all([scene('trailer-cars'), scene('truck-cab')]);
  const raw = new THREE.Box3().setFromObject(tr); // bounds with the Fabias still on, which the slots refer to
  const trailer = bake(tr).filter((p) => !/^(color\d?|fabia_wheel|glas)$/.test(p.material.name || '')).map((p) => ({ geo: p.geo, material: tidy(p.material) }));
  const slotLen = 0.95 * CAR_LEN_SCALE; // our cars ride at full size: a slot is about one car long
  const len = slotLen / SLOT_LEN;
  const { matrix } = normalise(trailer, len, true, raw); // hitch (+x in the file) to +z
  const s = raw.getSize(new THREE.Vector3());
  const slots = TRAILER_SLOTS.map(([fx, fy, pitch]) => ({ pos: new THREE.Vector3(raw.min.x + fx * s.x, raw.min.y + fy * s.y, (raw.min.z + raw.max.z) / 2).applyMatrix4(matrix), pitch, len: slotLen }));
  // Hyundai Xcient tractor ahead of the trailer: the cab clears the trailer front by about 1.2 m, the fifth wheel sits under it
  const cabParts = bake(cab).map((p) => ({ geo: p.geo, material: tidy(p.material) }));
  const { size: cabSize } = normalise(cabParts, 7.07 * METRE, CAB_FLIP);
  const cabZ = len / 2 + 3.5 * METRE - cabSize.z / 2;
  // the rig runs from the trailer's tail (-len/2) to the cab's nose (len/2 + 3.5 m): `center` is its midpoint
  transporter = { trailer, cab: cabParts, cabZ, slots, center: (3.5 * METRE) / 2 };
}
const CAR_LEN_SCALE = 1, CAB_FLIP = false;

// ---------- ship and containers ----------
export let ship = null, containerBox = null, containerOpen = null;
export async function loadModels() {
  await Promise.all([...Object.keys(CAR_MODELS).map(loadCar), loadTransporter()]);
  for (const [a, b] of Object.entries(ALIAS)) cars[a] = cars[b];
  const [s, box, open] = await Promise.all([scene('ship-container'), scene('container-box'), scene('container-open')]);
  s.traverse((o) => { if (o.isMesh && o.material.transparent) { o.material.transparent = false; o.material.depthWrite = true; } }); // the bridge is exported as BLEND for no reason
  ship = s;
  containerBox = bake(box)[0];
  containerBox.material = greyed(containerBox.material);
  containerOpen = bake(open);
  for (const p of containerOpen) p.material = greyed(p.material);
}
// a copy of `geo` stretched to w x h x l (length on z), centred, bottom at y = 0; `flip` turns it end for end
export function fit(geo, w, h, l, flip = false) {
  const g = geo.clone();
  g.computeBoundingBox();
  const s = g.boundingBox.getSize(new THREE.Vector3()), c = g.boundingBox.getCenter(new THREE.Vector3());
  g.translate(-c.x, -g.boundingBox.min.y, -c.z);
  if (s.x > s.z) { g.rotateY(Math.PI / 2); s.set(s.z, s.y, s.x); }
  if (flip) g.rotateY(Math.PI);
  g.scale(w / s.x, h / s.y, l / s.z);
  g.computeVertexNormals();
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
// containers are tinted per box: turn the source colour map into a light grey with the same grime, so the tint shows
function greyed(m) {
  const out = m.clone();
  const img = m.map?.image;
  if (!img) return out;
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, cv.width, cv.height);
  let sum = 0;
  for (let i = 0; i < d.data.length; i += 4) sum += 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
  const mean = sum / (d.data.length / 4);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = Math.min(255, ((0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]) / mean) * 205);
    d.data[i] = d.data[i + 1] = d.data[i + 2] = l;
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = m.map.flipY; t.wrapS = m.map.wrapS; t.wrapT = m.map.wrapT; t.anisotropy = 8;
  out.map = t;
  out.metalness = Math.min(out.metalness, 0.3);
  return out;
}
