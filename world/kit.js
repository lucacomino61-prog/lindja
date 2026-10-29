// Miniature kit for the relief model: trucks, containers, cranes, ships, planes, buildings, trees.
// Every piece is built from simple solids with flat shading, painted like a model railway layout.
import * as THREE from 'three';
import { rng } from './noise.js';
import * as models from './models.js';
import { fit } from './models.js';
import { Q } from './quality.js';
import { lodCut } from './impostor.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const C = {
  orange: '#FF4F12', ink: '#101418', white: '#F3F2EE', paper: '#EEF0EC', grey: '#B8BBB7', mid: '#7D8289', dark: '#43484F',
  glass: '#1E2A33', concrete: '#D8D5CD', asphalt: '#3B3E43', roof: '#C45E3B', wall: '#EEE7DA', olive: '#7E8B57',
  cypress: '#3E5A3B', pine: '#4C6A45', sand: '#E6D9BC', yellow: '#E9C24A', teal: '#2F6E8C', rust: '#A9452E', moss: '#69773D', sky: '#CFE0E8',
};

const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, flatShading: true, ...opts }));
  return mats.get(key);
}
const geoCache = new Map();
const box = (w, h, d) => { const k = `b${w},${h},${d}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d)); return geoCache.get(k); };
const cyl = (rt, rb, h, s = 8) => { const k = `c${rt},${rb},${h},${s}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, s)); return geoCache.get(k); };

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function shadowed(obj) { obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return obj; }

// ---------- painted lettering ----------
const texCache = new Map();
export function wordTexture(text, { bg = C.orange, fg = C.ink, w = 1024, h = 256, font = '800 190px "Big Shoulders Display"', pad = 0, align = 'center', tracking = 0 } = {}) {
  const key = [text, bg, fg, w, h, font, align].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.font = font; g.textBaseline = 'middle';
  g.letterSpacing = `${tracking}px`;
  g.textAlign = align;
  g.fillText(text, align === 'center' ? w / 2 : pad, h / 2 + h * 0.04);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}
function decal(tex, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, transparent: !!tex.userData?.alpha, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.receiveShadow = true;
  return m;
}

// ---------- road vehicles (front faces +z) ----------
export function truck({ livery = 'udha', trailer = true } = {}) {
  const g = new THREE.Group();
  const cabColor = livery === 'udha' ? C.orange : livery === 'blue' ? C.teal : C.white;
  // cab
  g.add(mesh(box(0.56, 0.5, 0.5), mat(cabColor), 0, 0.42, 1.18));
  g.add(mesh(box(0.54, 0.16, 0.46), mat(cabColor), 0, 0.74, 1.15));
  g.add(mesh(box(0.5, 0.2, 0.04), mat(C.glass, { roughness: 0.25 }), 0, 0.62, 1.44));
  g.add(mesh(box(0.58, 0.08, 0.06), mat(C.dark), 0, 0.2, 1.44));
  // chassis + wheels
  g.add(mesh(box(0.42, 0.1, 2.75), mat(C.dark), 0, 0.17, 0.05));
  const wheel = cyl(0.12, 0.12, 0.1, 10);
  const wm = mat('#1B1D21');
  for (const z of [1.2, 0.55, -0.85, -1.05, -1.25]) for (const x of [-0.27, 0.27]) {
    const w = mesh(wheel, wm, x, 0.12, z); w.rotation.z = Math.PI / 2; g.add(w);
  }
  if (trailer) {
    const tc = livery === 'udha' ? C.orange : livery === 'blue' ? C.white : C.grey;
    g.add(mesh(box(0.58, 0.66, 2.05), mat(tc), 0, 0.62, -0.18));
    if (livery === 'udha') {
      const tex = wordTexture('udha', { bg: C.orange, fg: C.ink, w: 1024, h: 256, font: '800 210px "Big Shoulders Display"' });
      for (const side of [-1, 1]) {
        const d = decal(tex, 1.9, 0.475);
        d.position.set(side * 0.295, 0.62, -0.18); d.rotation.y = side * Math.PI / 2; g.add(d);
      }
    }
  }
  return shadowed(g);
}
export function van(color = C.white) {
  const g = new THREE.Group();
  g.add(mesh(box(0.42, 0.42, 0.95), mat(color), 0, 0.33, 0));
  g.add(mesh(box(0.38, 0.14, 0.03), mat(C.glass, { roughness: 0.25 }), 0, 0.42, 0.48));
  const wheel = cyl(0.08, 0.08, 0.08, 8);
  for (const z of [0.3, -0.3]) for (const x of [-0.2, 0.2]) { const w = mesh(wheel, mat('#1B1D21'), x, 0.08, z); w.rotation.z = Math.PI / 2; g.add(w); }
  return shadowed(g);
}
export function forklift() {
  const g = new THREE.Group();
  g.add(mesh(box(0.22, 0.16, 0.34), mat(C.yellow), 0, 0.12, 0));
  g.add(mesh(box(0.2, 0.2, 0.04), mat(C.dark), 0, 0.3, 0.02));
  g.add(mesh(box(0.03, 0.36, 0.03), mat(C.dark), -0.08, 0.22, 0.19));
  g.add(mesh(box(0.03, 0.36, 0.03), mat(C.dark), 0.08, 0.22, 0.19));
  const forks = mesh(box(0.2, 0.02, 0.22), mat(C.dark), 0, 0.06, 0.3); g.add(forks);
  const pallet = mesh(box(0.22, 0.12, 0.22), mat('#C9A46B'), 0, 0.13, 0.3); g.add(pallet);
  g.userData = { forks, pallet };
  return shadowed(g);
}
export function person(color = C.ink) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.035, 0.045, 0.16, 6), mat(color), 0, 0.08, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.035, 0), mat('#D9B08C'), 0, 0.2, 0));
  return shadowed(g);
}

// ---------- containers ----------
export const CONTAINER_COLORS = [C.orange, C.teal, C.rust, C.white, C.ink, C.moss, C.orange, C.grey];
export function containerStacks(slots, seed = 3, len = 1.7) {
  // slots: [{x,y,z,rotY}] → one InstancedMesh of the textured Sketchfab box (world/models.js), colour per box
  const r = rng(seed);
  const geo = fit(models.containerBox.geo, 0.42, 0.44, len);
  const im = new THREE.InstancedMesh(geo, models.containerBox.material, slots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), col = new THREE.Color();
  slots.forEach((sl, i) => {
    p.set(sl.x, sl.y, sl.z); q.setFromEuler(new THREE.Euler(0, sl.rotY || 0, 0));
    m4.compose(p, q, s); im.setMatrixAt(i, m4);
    col.set(sl.color || CONTAINER_COLORS[Math.floor(r() * CONTAINER_COLORS.length)]); im.setColorAt(i, col);
  });
  im.castShadow = true; im.receiveShadow = true;
  return im;
}
export function containerBox(color = C.orange, len = 1.7) {
  const g = new THREE.Group();
  const m = models.containerBox.material.clone(); m.color.set(color);
  g.add(mesh(fit(models.containerBox.geo, 0.42, 0.44, len), m, 0, 0, 0));
  if (color === C.orange) {
    const tex = wordTexture('lindja', { bg: null, fg: C.ink, w: 1024, h: 256 });
    for (const side of [-1, 1]) { const d = decal(tex, len * 0.62, len * 0.155); d.position.set(side * 0.214, 0.22, 0); d.rotation.y = side * Math.PI / 2; g.add(d); }
  }
  return shadowed(g);
}

// ---------- port ----------
// Ship-to-shore container crane at port proportions (0.2 units per metre): portal on four legs with bogies, trucks
// pass along the quay between them; lattice boom over the water, hinged at the seaside legs so an idle crane can raise
// it; A-frame with backstays and forestays; machinery house on the backreach; trolley with the operator cab, ropes,
// a 40 ft spreader and the container it carries. Boom points -x (over the water).
const STS = { legX: 1.4, legZ: 1.6, portalY: 5.5, chordLo: 5.9, chordHi: 6.55, girderZ: 0.42, hingeX: -1.4, back: 3.2, reach: 7.8, apex: [0.2, 10.0] };
function beam(a, b, t = 0.09) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.BoxGeometry(t, len, t);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
// one lattice girder from x0 to x1 (bottom chord at y0, top at y1), zig-zag diagonals; both girders and top ties
function girders(x0, x1, y0, y1, out, taper = 0) {
  const zs = [-STS.girderZ, STS.girderZ], n = Math.max(2, Math.round(Math.abs(x1 - x0) / 0.65));
  const top = (x) => y1 - taper * Math.max(0, (Math.abs(x - x0) - Math.abs(x1 - x0) + 1.3) / 1.3) * (y1 - y0) * 0.55;
  for (const z of zs) {
    out.push(beam(v3(x0, y0, z), v3(x1, y0, z), 0.1));
    for (let i = 0; i < n; i++) {
      const a = x0 + ((x1 - x0) * i) / n, b = x0 + ((x1 - x0) * (i + 1)) / n;
      out.push(beam(v3(a, top(a), z), v3(b, top(b), z), 0.09));
      out.push(beam(i % 2 ? v3(a, y0, z) : v3(a, top(a), z), i % 2 ? v3(b, top(b), z) : v3(b, y0, z), 0.05));
    }
  }
  for (let i = 0; i <= n; i += 2) { const x = x0 + ((x1 - x0) * i) / n; out.push(beam(v3(x, top(x), -STS.girderZ), v3(x, top(x), STS.girderZ), 0.06)); out.push(beam(v3(x, y0, -STS.girderZ), v3(x, y0, STS.girderZ), 0.06)); }
}
export function stsCrane() {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: C.orange, roughness: 0.5, metalness: 0.25 });
  const steel = new THREE.MeshStandardMaterial({ color: '#2E3238', roughness: 0.55, metalness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: '#EEEDE8', roughness: 0.6 });
  const { legX: X, legZ: Z, portalY: P, chordLo: lo, chordHi: hi, girderZ: gz } = STS;
  const fixed = [], dark = [], house = [];
  for (const x of [-X, X]) {
    for (const z of [-Z, Z]) { fixed.push(beam(v3(x, 0.2, z), v3(x, P, z), 0.2)); dark.push(new THREE.BoxGeometry(0.36, 0.22, 0.95).translate(x, 0.11, z)); fixed.push(beam(v3(x, P, z), v3(x, lo, z > 0 ? gz : -gz), 0.14)); }
    fixed.push(beam(v3(x, P, -Z - 0.1), v3(x, P, Z + 0.1), 0.24), beam(v3(x, 3.6, -Z), v3(x, 3.6, Z), 0.16));
    fixed.push(beam(v3(x, 3.6, -Z), v3(x, P, Z), 0.09), beam(v3(x, 3.6, Z), v3(x, P, -Z), 0.09));
  }
  for (const z of [-Z, Z]) fixed.push(beam(v3(-X - 0.1, P, z), v3(X + 0.1, P, z), 0.24));
  girders(STS.hingeX, STS.back, lo, hi, fixed); // backreach, fixed
  const [ax, ay] = STS.apex;
  for (const z of [-gz, gz]) { fixed.push(beam(v3(-X, hi, z), v3(ax, ay, z), 0.17), beam(v3(X, hi, z), v3(ax, ay, z), 0.17)); dark.push(beam(v3(ax, ay, z), v3(STS.back, hi, z), 0.035)); }
  fixed.push(beam(v3(ax, ay, -gz - 0.08), v3(ax, ay, gz + 0.08), 0.18), beam(v3(-0.6, 8.3, -gz), v3(-0.6, 8.3, gz), 0.1));
  house.push(new THREE.BoxGeometry(1.5, 0.8, 1.05).translate(2.3, hi + 0.4, 0));
  const add = (list, material, parent = g) => { const m = new THREE.Mesh(mergeGeometries(list), material); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  add(fixed, paint); add(dark, steel); add(house, white);
  // outer boom on its hinge at the seaside legs
  const pivot = new THREE.Group(); pivot.position.set(STS.hingeX, lo, 0); g.add(pivot);
  const boom = []; girders(0, -STS.reach, 0, hi - lo, boom, 1);
  add(boom, paint, pivot);
  // forestays from the apex to two points on the boom, re-laid when the boom moves
  const stayGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 5);
  const stays = [];
  for (const bx of [-3.6, -7.0]) for (const z of [-gz, gz]) { const s = new THREE.Mesh(stayGeo, steel); s.castShadow = true; g.add(s); stays.push({ s, bx, z }); }
  // trolley, cab, ropes, spreader, container
  const trolley = new THREE.Group(); g.add(trolley);
  trolley.add(mesh(new THREE.BoxGeometry(0.82, 0.2, 1.0), steel, 0, lo + 0.1, 0));
  trolley.add(mesh(new THREE.BoxGeometry(0.38, 0.34, 0.36), white, 0.26, lo - 0.3, 0.6));
  trolley.add(mesh(new THREE.BoxGeometry(0.02, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: '#1C2730', roughness: 0.1, metalness: 0.2 }), 0.07, lo - 0.3, 0.6));
  const ropeGeo = new THREE.BoxGeometry(0.025, 1, 0.025); ropeGeo.translate(0, -0.5, 0);
  const ropes = [-0.9, 0.9].map((z) => { const r = mesh(ropeGeo, steel, 0, lo, z); trolley.add(r); return r; });
  const spreader = new THREE.Group(); trolley.add(spreader);
  const yellow = new THREE.MeshStandardMaterial({ color: '#E3B526', roughness: 0.5, metalness: 0.2 });
  spreader.add(mesh(new THREE.BoxGeometry(0.42, 0.08, 2.5), yellow, 0, 0, 0), mesh(new THREE.BoxGeometry(0.5, 0.1, 0.12), yellow, 0, 0, 1.2), mesh(new THREE.BoxGeometry(0.5, 0.1, 0.12), yellow, 0, 0, -1.2));
  const carried = containerBox(C.orange, 2.44); carried.position.y = -0.48; spreader.add(carried); // its top under the spreader
  g.userData = { trolley, spreader, ropes, carried, pivot, stays };
  setBoom(g, 0); setCrane(g, 0.4, 3);
  return shadowed(g);
}
// trolley at x along the boom, spreader (its underside) at height y above the quay
export function setCrane(c, x, y) {
  const { trolley, spreader, ropes } = c.userData;
  trolley.position.x = x;
  spreader.position.y = y + 0.04;
  for (const r of ropes) r.scale.y = Math.max(0.05, STS.chordLo - y - 0.04);
}
// boom angle: 0 working, negative raised (an idle crane stands with its boom up, about -1.3)
export function setBoom(c, angle) {
  const { pivot, stays } = c.userData;
  pivot.rotation.z = angle;
  const [ax, ay] = STS.apex, cos = Math.cos(angle), sin = Math.sin(angle), h = STS.chordHi - STS.chordLo;
  for (const { s, bx, z } of stays) {
    const a = v3(ax, ay, z), b = v3(STS.hingeX + bx * cos - h * sin, STS.chordLo + bx * sin + h * cos, z);
    const d = b.clone().sub(a);
    s.position.copy(a).addScaledVector(d, 0.5); s.scale.set(1, d.length(), 1);
    s.quaternion.setFromUnitVectors(v3(0, 1, 0), d.normalize());
  }
}
// One loop of crane work. load: a container lifted off a waiting truck at the portal (x = land) and lowered into the
// ship's hold (x = ship); unload: the same run backwards, out of the hold onto the truck. Container handover happens
// at tau = 0 with the spreader down on the truck, so the trucks' stop window has to span the loop seam.
const lerp = THREE.MathUtils.lerp, sm = (a, b, t) => THREE.MathUtils.smoothstep(t, a, b);
export function craneWork(c, tau, { mode = 'load', land = 0, ship = -5.2, truckY = 0.8, holdY = 0.9, highY = 4.9 } = {}) {
  const t = mode === 'load' ? tau : 6 - tau;
  // load timeline: hoist 0–1.2, travel 1.2–2.6, lower into the hold 2.6–3.6, release, hoist 3.8–4.6, back 4.6–5.6, down 5.6–6
  let x, y;
  if (t < 1.2) { x = land; y = lerp(truckY, highY, sm(0, 1.2, t)); }
  else if (t < 2.6) { x = lerp(land, ship, sm(1.2, 2.6, t)); y = highY; }
  else if (t < 3.6) { x = ship; y = lerp(highY, holdY, sm(2.6, 3.6, t)); }
  else if (t < 3.8) { x = ship; y = holdY; }
  else if (t < 4.6) { x = ship; y = lerp(holdY, highY, sm(3.8, 4.6, t)); }
  else if (t < 5.6) { x = lerp(ship, land, sm(4.6, 5.6, t)); y = highY; }
  else { x = land; y = lerp(highY, truckY, sm(5.6, 6, t)); }
  setCrane(c, x, y);
  c.userData.carried.visible = t < 3.7; // in load mode it rides from the truck into the hold; unload mirrors it
}

export function ship({ len = 26, seed = 9 } = {}) {
  const g = new THREE.Group();
  const w = 4.2;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, -len / 2); sh.lineTo(w / 2, -len / 2); sh.lineTo(w / 2, len / 2 - 4); sh.quadraticCurveTo(w / 2, len / 2 - 1, 0, len / 2 + 0.6); sh.quadraticCurveTo(-w / 2, len / 2 - 1, -w / 2, len / 2 - 4); sh.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false });
  hullGeo.rotateX(-Math.PI / 2); hullGeo.rotateY(Math.PI); hullGeo.translate(0, -0.9, 0); // bow to +z
  g.add(mesh(hullGeo, mat(C.ink), 0, 0, 0));
  // orange boot-top stripe
  const stripe = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }); stripe.rotateX(-Math.PI / 2); stripe.rotateY(Math.PI); stripe.scale(1.01, 1, 1.004);
  g.add(mesh(stripe, mat(C.orange), 0, -0.85, 0));
  // superstructure at stern (-z)
  g.add(mesh(box(3.6, 2.6, 2.2), mat(C.white), 0, 2.0, -len / 2 + 2));
  g.add(mesh(box(4.4, 0.25, 1.2), mat(C.white), 0, 3.0, -len / 2 + 2.3));
  g.add(mesh(box(3.0, 0.3, 0.06), mat(C.glass, { roughness: 0.3 }), 0, 2.85, -len / 2 + 3.12));
  g.add(mesh(box(0.8, 1.4, 0.8), mat(C.orange), 0, 3.7, -len / 2 + 1.4));
  // container bays
  const slots = [];
  const r = rng(seed);
  for (let bay = 0; bay < 11; bay++) {
    const z = -len / 2 + 4.6 + bay * 1.82;
    if (z > len / 2 - 3.2) break;
    for (let row = 0; row < 8; row++) {
      const x = -1.65 + row * 0.47;
      const tiers = 1 + Math.floor(r() * 3.2);
      for (let t = 0; t < tiers; t++) slots.push({ x, y: 0.7 + t * 0.45, z });
    }
  }
  g.add(containerStacks(slots, seed));
  // hull name
  const tex = wordTexture('UDHA ADRIATIK', { bg: C.ink, fg: C.white, w: 2048, h: 256, font: '700 150px "Big Shoulders Display"', tracking: 6 });
  const d = decal(tex, 9, 1.1); d.position.set(w / 2 + 0.03, 0.15, 3); d.rotation.y = Math.PI / 2; g.add(d);
  return shadowed(g);
}

export function ferry() {
  const g = new THREE.Group();
  const len = 18, w = 3.6;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, -len / 2); sh.lineTo(w / 2, -len / 2); sh.lineTo(w / 2, len / 2 - 3); sh.quadraticCurveTo(w / 2, len / 2, 0, len / 2 + 0.4); sh.quadraticCurveTo(-w / 2, len / 2, -w / 2, len / 2 - 3); sh.closePath();
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 1.5, bevelEnabled: false }); hull.rotateX(-Math.PI / 2); hull.rotateY(Math.PI); hull.translate(0, -0.8, 0);
  g.add(mesh(hull, mat(C.white), 0, 0, 0));
  const band = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false }); band.rotateX(-Math.PI / 2); band.rotateY(Math.PI); band.scale(1.01, 1, 1.005);
  g.add(mesh(band, mat(C.teal), 0, -0.4, 0));
  g.add(mesh(box(3.2, 1.0, 11), mat(C.white), 0, 1.2, -1.2));
  g.add(mesh(box(2.8, 0.9, 7), mat(C.white), 0, 2.15, -1.8));
  g.add(mesh(box(3.25, 0.22, 11.05), mat(C.glass, { roughness: 0.3 }), 0, 1.3, -1.2));
  g.add(mesh(box(2.85, 0.2, 7.05), mat(C.glass, { roughness: 0.3 }), 0, 2.25, -1.8));
  g.add(mesh(cyl(0.45, 0.55, 1.2, 8), mat(C.teal), 0, 3.0, -4));
  return shadowed(g);
}

export function bollardsRow(len, step = 2.2) {
  const g = new THREE.Group();
  for (let z = -len / 2; z <= len / 2; z += step) g.add(mesh(cyl(0.07, 0.09, 0.14, 6), mat(C.dark), 0, 0.07, z));
  return g;
}

// ---------- buildings ----------
export function warehouse({ w = 20, d = 9, h = 2.4, doors = 8, sign = 'udha' } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(w, h, d), mat(C.white), 0, h / 2, 0));
  // shallow roof ridges with skylights
  for (let i = 0; i < 5; i++) {
    const z = -d / 2 + d * (i + 0.5) / 5;
    const r = mesh(box(w - 0.4, 0.22, d / 5 - 0.25), mat(C.grey), 0, h + 0.11, z); g.add(r);
    g.add(mesh(box(w - 2.4, 0.06, 0.35), mat('#9DB3BF', { roughness: 0.3 }), 0, h + 0.25, z));
  }
  // orange fascia band and dock doors on the +z side
  g.add(mesh(box(w + 0.02, 0.35, d + 0.02), mat(C.orange), 0, h - 0.2, 0));
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + 1.6 + i * ((w - 3.2) / (doors - 1));
    g.add(mesh(box(0.9, 1.05, 0.08), mat(C.dark), x, 0.72, d / 2 + 0.02));
    g.add(mesh(box(1.1, 0.12, 0.6), mat(C.concrete), x, 0.25, d / 2 + 0.3));
    g.add(mesh(box(0.12, 1.25, 0.12), mat(C.orange), x - 0.56, 0.62, d / 2 + 0.05));
    g.add(mesh(box(0.12, 1.25, 0.12), mat(C.orange), x + 0.56, 0.62, d / 2 + 0.05));
  }
  g.add(mesh(box(w, 0.3, 1.2), mat(C.concrete), 0, 0.15, d / 2 + 0.6)); // dock apron
  if (sign) {
    const tex = wordTexture(sign, { bg: null, fg: C.ink, w: 1024, h: 256, font: '800 230px "Big Shoulders Display"' });
    tex.userData.alpha = true;
    const s = decal(tex, 4.2, 1.05); s.material.transparent = true; s.position.set(-w / 2 + 3.4, h - 0.95, d / 2 + 0.03); g.add(s);
  }
  return shadowed(g);
}
// ---------- buildings (0.2 units per metre) ----------
const canvasTex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
const RIBS = canvasTex(128, 64, (g, w, h) => { // trapezoidal metal cladding, one rib per 32 px
  g.fillStyle = '#E4E5E2'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) { g.fillStyle = '#F6F6F3'; g.fillRect(x + 4, 0, 8, h); g.fillStyle = '#B9BCBC'; g.fillRect(x + 12, 0, 3, h); g.fillStyle = '#CDD0CF'; g.fillRect(x, 0, 3, h); }
});
const ROLLER = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#7C8187'; g.fillRect(0, 0, w, h); g.fillStyle = '#62676D'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 2); });
const CURTAIN = canvasTex(256, 256, (g, w, h) => { // two storeys of curtain wall: glass, mullions, spandrels
  for (let f = 0; f < 2; f++) {
    const y0 = f * 128;
    const grad = g.createLinearGradient(0, y0, 0, y0 + 96); grad.addColorStop(0, '#6F8797'); grad.addColorStop(1, '#3E5260');
    g.fillStyle = grad; g.fillRect(0, y0, w, 96);
    g.fillStyle = '#C9CDCF'; g.fillRect(0, y0 + 96, w, 32); // spandrel
    g.fillStyle = '#2A3238'; for (let x = 0; x < w; x += 64) g.fillRect(x, y0, 5, 128); g.fillRect(0, y0 + 94, w, 4);
  }
});
function ribbedMat(color, repX, repY) { const t = RIBS.clone(); t.repeat.set(repX, repY); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ color, map: t, roughness: 0.5, metalness: 0.35 }); }

// warehouse / shed: ribbed cladding on a concrete plinth, a low gable roof with skylight strips, gutters, downpipes,
// roller doors and a personnel door on the front (+z); base at y = 0
export function shed({ w = 10, d = 6, h = 2, color = C.white, roof = C.grey, doors = true } = {}) {
  const g = new THREE.Group();
  const long = ribbedMat(color, w / 0.85, 1), short = ribbedMat(color, d / 0.85, 1), plain = mat(color);
  g.add(mesh(new THREE.BoxGeometry(w, h, d), [short, short, plain, plain, long, long], 0, h / 2, 0));
  g.add(mesh(box(w + 0.04, 0.22, d + 0.04), mat('#A9A69F', { roughness: 0.9 }), 0, 0.11, 0)); // plinth
  // gable roof, ridge along x
  const rise = (d / 2) * Math.tan(0.14), slope = Math.hypot(d / 2 + 0.2, rise);
  const roofMat = new THREE.MeshStandardMaterial({ color: roof, roughness: 0.55, metalness: 0.3, map: (() => { const t = RIBS.clone(); t.repeat.set(w / 0.9, 1); t.rotation = Math.PI / 2; t.needsUpdate = true; return t; })() });
  for (const s of [-1, 1]) {
    const p = mesh(box(w + 0.3, 0.06, slope), roofMat, 0, h + rise / 2, s * (d / 4 + 0.05)); p.rotation.x = s * 0.14; g.add(p);
    for (let x = -w / 2 + 1.2; x < w / 2 - 0.8; x += 2.4) { const sk = mesh(box(0.7, 0.03, slope * 0.55), mat('#E8F0F2', { roughness: 0.2, emissive: '#DDE7EA', emissiveIntensity: 0.15 }), x, h + rise / 2 + 0.04, s * (d / 4 + 0.05)); sk.rotation.x = s * 0.14; g.add(sk); }
  }
  const gable = new THREE.Shape(); gable.moveTo(-d / 2, 0); gable.lineTo(0, rise); gable.lineTo(d / 2, 0); gable.closePath();
  for (const s of [-1, 1]) { const gg = new THREE.ShapeGeometry(gable); gg.rotateY(Math.PI / 2); const gm = mesh(gg, plain, s * w / 2, h, 0); if (s < 0) gm.rotation.y = Math.PI; g.add(gm); }
  for (const s of [-1, 1]) g.add(mesh(box(w + 0.3, 0.07, 0.08), mat('#8C9196', { metalness: 0.6, roughness: 0.4 }), 0, h - 0.02, s * (d / 2 + 0.1))); // gutters
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) for (const s of [-1, 1]) g.add(mesh(box(0.05, h, 0.05), mat('#8C9196', { metalness: 0.6 }), x, h / 2, s * (d / 2 + 0.06)));
  if (doors) {
    const n = Math.max(1, Math.floor(w / 3.2)), dw = Math.min(1.5, (w / n) * 0.55), dh = Math.min(1.4, h * 0.72);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      const rd = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshStandardMaterial({ map: ROLLER, roughness: 0.6, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 })); rd.position.set(x, dh / 2 + 0.05, d / 2 + 0.012); rd.receiveShadow = true; g.add(rd);
      g.add(mesh(box(dw + 0.12, 0.08, 0.06), mat('#3A3F45'), x, dh + 0.09, d / 2 + 0.03));
      g.add(mesh(box(0.06, 0.1, 0.12), mat('#F2B630', { emissive: '#F2B630', emissiveIntensity: 0.2 }), x - dw / 2 - 0.1, 0.06, d / 2 + 0.15)); // dock bumper
    }
    g.add(mesh(box(0.36, 0.5, 0.03), mat('#2D3238'), w / 2 - 0.5, 0.3, d / 2 + 0.015)); // personnel door
  }
  return shadowed(g);
}
// office block: reflective curtain wall with mullions and spandrels, parapet, rooftop plant, entrance canopy and the brand band
export function office({ w = 5, d = 4, floors = 4 } = {}) {
  const g = new THREE.Group();
  const fh = 0.7, H = floors * fh;
  const glass = (rep) => { const t = CURTAIN.clone(); t.repeat.set(rep, floors / 2); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.12, metalness: 0.55 }); };
  const gw = glass(w / 2.4), gd = glass(d / 2.4), top = mat('#BFC2C1');
  g.add(mesh(new THREE.BoxGeometry(w, H, d), [gd, gd, top, top, gw, gw], 0, H / 2, 0));
  g.add(mesh(box(w + 0.12, 0.22, d + 0.12), mat(C.orange), 0, H + 0.11, 0)); // brand parapet band
  g.add(mesh(box(w * 0.4, 0.3, d * 0.35), mat('#9EA3A6', { metalness: 0.4 }), -w * 0.15, H + 0.37, 0)); // plant
  g.add(mesh(box(0.5, 0.22, 0.5), mat('#9EA3A6', { metalness: 0.4 }), w * 0.28, H + 0.33, -d * 0.2));
  g.add(mesh(box(1.6, 0.06, 0.9), mat('#E8E9E5'), 0, 0.62, d / 2 + 0.45)); // entrance canopy
  for (const x of [-0.7, 0.7]) g.add(mesh(box(0.05, 0.6, 0.05), mat('#3A3F45'), x, 0.3, d / 2 + 0.85));
  return shadowed(g);
}

// ---------- airport ----------
export function runway(len = 90, w = 4.2) {
  const g = new THREE.Group();
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat(C.asphalt, { flatShading: false, roughness: 0.95 }));
  strip.rotation.x = -Math.PI / 2; strip.receiveShadow = true; g.add(strip);
  const dash = new THREE.PlaneGeometry(0.12, 1.6), dm = mat(C.white, { flatShading: false });
  for (let z = -len / 2 + 6; z < len / 2 - 6; z += 3.4) { const m = new THREE.Mesh(dash, dm); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.012, z); m.receiveShadow = true; g.add(m); }
  for (const end of [-1, 1]) for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2.2), dm); m.rotation.x = -Math.PI / 2; m.position.set(-1.6 + i * 0.46, 0.012, end * (len / 2 - 2)); m.receiveShadow = true; g.add(m);
  }
  return g;
}
export function plane({ livery = C.white } = {}) {
  // cargo jet, nose +z, about 12 units long
  const g = new THREE.Group();
  const fus = mesh(cyl(0.75, 0.75, 9.5, 10), mat(livery), 0, 1.25, 0); fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = mesh(new THREE.SphereGeometry(0.75, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(livery), 0, 1.25, 4.75); nose.rotation.x = Math.PI / 2; nose.scale.set(1, 1.7, 1); g.add(nose);
  const tail = mesh(new THREE.ConeGeometry(0.75, 3.2, 10), mat(livery), 0, 1.45, -6.3); tail.rotation.x = -Math.PI / 2; tail.scale.set(1, 1, 0.75); g.add(tail);
  g.add(mesh(box(1.25, 0.18, 0.06), mat(C.glass, { roughness: 0.2 }), 0, 1.68, 5.4));
  // wings
  const wsh = new THREE.Shape(); wsh.moveTo(0, 1.4); wsh.lineTo(6.6, -1.6); wsh.lineTo(6.6, -2.3); wsh.lineTo(0, -1.4); wsh.closePath();
  const wg = new THREE.ExtrudeGeometry(wsh, { depth: 0.14, bevelEnabled: false }); wg.rotateX(Math.PI / 2);
  const wR = mesh(wg, mat(livery), 0.5, 0.95, 0.4); g.add(wR);
  const wL = mesh(wg.clone().scale(-1, 1, 1), mat(livery), -0.5, 0.95, 0.4); g.add(wL);
  for (const x of [-2.6, 2.6]) { const e = mesh(cyl(0.34, 0.34, 1.5, 10), mat(C.grey), x, 0.62, 1.4); e.rotation.x = Math.PI / 2; g.add(e); }
  const hsh = new THREE.Shape(); hsh.moveTo(0, 0.6); hsh.lineTo(2.4, -0.6); hsh.lineTo(2.4, -1.0); hsh.lineTo(0, -0.8); hsh.closePath();
  const hg = new THREE.ExtrudeGeometry(hsh, { depth: 0.08, bevelEnabled: false }); hg.rotateX(Math.PI / 2);
  g.add(mesh(hg, mat(livery), 0.2, 1.7, -6.3)); g.add(mesh(hg.clone().scale(-1, 1, 1), mat(livery), -0.2, 1.7, -6.3));
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(1.0, 2.2); fin.lineTo(1.9, 2.2); fin.lineTo(2.4, 0); fin.closePath();
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: false }); fg.rotateY(Math.PI / 2); fg.translate(-0.05, 0, -5.2);
  g.add(mesh(fg, mat(C.ink), 0, 1.7, -2.4));
  // gear
  for (const [x, z] of [[0, 3.8], [-0.9, -0.4], [0.9, -0.4]]) g.add(mesh(cyl(0.18, 0.18, 0.2, 8), mat('#1B1D21'), x, 0.2, z));
  for (const [x, z] of [[0, 3.8], [-0.9, -0.4], [0.9, -0.4]]) g.add(mesh(box(0.08, 0.5, 0.08), mat(C.grey), x, 0.45, z));
  return shadowed(g);
}
export function uld() {
  const g = new THREE.Group();
  g.add(mesh(box(0.7, 0.6, 0.6), mat(C.orange), 0, 0.36, 0));
  g.add(mesh(box(0.72, 0.06, 0.62), mat(C.dark), 0, 0.05, 0));
  return shadowed(g);
}
export function tug() {
  const g = new THREE.Group();
  g.add(mesh(box(0.42, 0.22, 0.6), mat(C.yellow), 0, 0.17, 0));
  g.add(mesh(box(0.36, 0.24, 0.2), mat(C.glass, { roughness: 0.3 }), 0, 0.38, -0.1));
  return shadowed(g);
}

// ---------- border ----------
export function customsCanopy({ lanes = 5, laneW = 1.6, depth = 5, sign = 'DOGANA' } = {}) {
  const g = new THREE.Group();
  const width = lanes * laneW + 0.6;
  g.add(mesh(box(width, 0.4, depth), mat(C.white), 0, 2.6, 0));
  g.add(mesh(box(width + 0.04, 0.16, depth + 0.04), mat(C.ink), 0, 2.36, 0));
  const tex = wordTexture(sign, { bg: C.ink, fg: C.white, w: 2048, h: 160, font: '700 110px "Big Shoulders Display"', tracking: 12 });
  for (const side of [1, -1]) { const s = decal(tex, width * 0.7, width * 0.7 * 160 / 2048); s.position.set(0, 2.36, side * (depth / 2 + 0.03)); if (side < 0) s.rotation.y = Math.PI; g.add(s); }
  const booths = [], barriers = [];
  for (let i = 0; i <= lanes; i++) {
    const x = -width / 2 + 0.3 + i * laneW;
    g.add(mesh(box(0.18, 2.3, 0.18), mat(C.grey), x, 1.15, -depth / 2 + 0.6));
    g.add(mesh(box(0.18, 2.3, 0.18), mat(C.grey), x, 1.15, depth / 2 - 0.6));
    if (i < lanes) {
      const bx = x + 0.15;
      const booth = new THREE.Group();
      booth.add(mesh(box(0.42, 0.8, 0.9), mat(C.white), 0, 0.55, 0));
      booth.add(mesh(box(0.44, 0.24, 0.92), mat(C.glass, { roughness: 0.3 }), 0, 0.72, 0));
      booth.add(mesh(box(0.5, 0.06, 1.0), mat(C.orange), 0, 0.98, 0));
      booth.position.set(bx, 0.1, 0); g.add(shadowed(booth)); booths.push(booth);
      g.add(mesh(box(0.5, 0.2, 1.6), mat(C.concrete), bx, 0.1, 0));
      const arm = new THREE.Group();
      const bar = mesh(box(laneW - 0.45, 0.06, 0.06), mat(C.white), (laneW - 0.45) / 2, 0, 0); arm.add(bar);
      for (let k = 0; k < 3; k++) arm.add(mesh(box(0.14, 0.065, 0.065), mat('#D2332A'), 0.2 + k * 0.38, 0, 0));
      arm.position.set(bx + 0.25, 0.62, depth / 2 - 0.2);
      g.add(shadowed(arm)); barriers.push(arm);
    }
  }
  // under the roof: light strips; on the ground: lane lines, stop lines, speed bumps; traffic lights and an ANPR gantry
  for (let i = 0; i < lanes; i++) {
    const x = -width / 2 + 0.3 + (i + 0.5) * laneW;
    g.add(mesh(box(laneW * 0.5, 0.03, depth * 0.8), mat('#FFF6E2', { emissive: '#FFF1D6', emissiveIntensity: 0.6 }), x, 2.39, 0));
    for (const z of [-depth / 2 - 0.6, depth / 2 + 0.6]) { const sb = mesh(box(laneW * 0.7, 0.025, 0.14), mat('#E7C13A'), x, 0.012, z); g.add(sb); for (let k = -1; k <= 1; k += 2) g.add(mesh(box(laneW * 0.1, 0.027, 0.141), mat('#1C1D1F'), x + k * laneW * 0.15, 0.013, z)); }
    g.add(mesh(box(laneW * 0.8, 0.012, 0.06), mat('#ECEAE3'), x, 0.007, depth / 2 + 0.25)); // stop line
    const tl = new THREE.Group();
    tl.add(mesh(box(0.08, 0.2, 0.06), mat('#16181A')));
    tl.add(mesh(box(0.05, 0.05, 0.02), mat('#3DDB6B', { emissive: '#3DDB6B', emissiveIntensity: 1.4 }), 0, -0.05, 0.035));
    tl.add(mesh(box(0.05, 0.05, 0.02), mat('#5A1C1C'), 0, 0.05, 0.035));
    tl.position.set(x - laneW / 2 + 0.1, 1.4, depth / 2 - 0.5); g.add(tl);
  }
  for (let i = 0; i <= lanes; i++) g.add(mesh(box(0.05, 0.012, depth + 4), mat('#ECEAE3'), -width / 2 + 0.3 + i * laneW, 0.006, 0));
  g.add(mesh(box(width, 0.12, 0.12), mat('#5C6166', { metalness: 0.5 }), 0, 2.0, -depth / 2 - 1.6)); // ANPR gantry
  for (const x of [-width / 2, width / 2]) g.add(mesh(box(0.1, 2.0, 0.1), mat('#5C6166', { metalness: 0.5 }), x, 1.0, -depth / 2 - 1.6));
  for (let i = 0; i < lanes; i++) g.add(mesh(box(0.1, 0.08, 0.14), mat('#1C1D1F'), -width / 2 + 0.3 + (i + 0.5) * laneW, 1.9, -depth / 2 - 1.6));
  g.userData = { barriers, width };
  return shadowed(g);
}

// ---------- scatter: trees, houses, bunkers ----------
function instanced(geo, material, matrices, colors) {
  const im = new THREE.InstancedMesh(geo, material, matrices.length);
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  if (colors) { const c = new THREE.Color(); colors.forEach((hex, i) => im.setColorAt(i, c.set(hex))); }
  im.castShadow = true; im.receiveShadow = true;
  return im;
}
const M = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

export const TREE_LAYER = 2; // the reflection camera leaves trees out (world.js)
// live page: the light-model tiles; world/live.js shows only those near the camera (the cards cover the rest)
export const treeTiles = [];
export function scatterTrees(points, { near = () => true } = {}) {
  if (Q.live) return scatterTreesLive(points);
  // Sketchfab olives, cypresses and pines (world/models.js), instanced per 48-unit tile so the camera only draws the
  // tiles in view; near(x, z) picks the full model, otherwise the far copy. points: [{x,y,z,kind,s}]
  const g = new THREE.Group(), r = rng(77), TILE = 48;
  const groups = new Map();
  for (const p of points) {
    const key = [p.kind, near(p.x, p.z) ? 'near' : 'far', Math.floor(p.x / TILE), Math.floor(p.z / TILE)].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  for (const [key, list] of groups) {
    const [kind, lod] = key.split('|');
    const mats = list.map((p) => { const s = (p.s || 1) * (0.85 + r() * 0.3); return m4.compose(pos.set(p.x, p.y - 0.03, p.z), q.setFromEuler(e.set(0, r() * 6.283, 0)), sc.set(s, s * (0.9 + r() * 0.2), s)).clone(); });
    const tints = list.map(() => new THREE.Color(0.82 + r() * 0.22, 0.86 + r() * 0.18, 0.8 + r() * 0.18)); // a little variety in the crowns
    for (const part of models.trees[kind][lod]) {
      const im = new THREE.InstancedMesh(part.geo, part.material, list.length);
      mats.forEach((mm, i) => im.setMatrixAt(i, mm));
      if (part.leaf) tints.forEach((c, i) => im.setColorAt(i, c));
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      im.layers.set(TREE_LAYER);
      g.add(im);
    }
  }
  return g;
}
// the same trees for the live page: light models in 48-unit tiles near the camera, one card mesh per kind beyond
// (world/impostor.js); every tree stands where it does in the film (turn and size drawn afresh)
function scatterTreesLive(points) {
  const g = new THREE.Group(), r = rng(77), TILE = 48;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  const tiles = new Map(), byKind = new Map(), cut = new Set();
  for (const p of points) {
    const s = (p.s || 1) * (0.85 + r() * 0.3);
    const mm = m4.compose(pos.set(p.x, p.y - 0.03, p.z), q.setFromEuler(e.set(0, r() * 6.283, 0)), sc.set(s, s * (0.9 + r() * 0.2), s)).clone();
    const tint = new THREE.Color(0.82 + r() * 0.22, 0.86 + r() * 0.18, 0.8 + r() * 0.18);
    const key = [p.kind, Math.floor(p.x / TILE), Math.floor(p.z / TILE)].join('|');
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push({ mm, tint });
    if (!byKind.has(p.kind)) byKind.set(p.kind, []);
    byKind.get(p.kind).push({ mm, tint });
  }
  const im = (geo, material, list, tinted) => {
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((it, i) => { mesh.setMatrixAt(i, it.mm); if (tinted) mesh.setColorAt(i, it.tint); });
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere(); mesh.layers.set(TREE_LAYER);
    return mesh;
  };
  for (const [key, list] of tiles) {
    const [kind, tx, tz] = key.split('|');
    const meshes = models.trees[kind].far.map((part) => {
      if (!cut.has(part.material)) { lodCut(part.material, true); cut.add(part.material); }
      return im(part.geo, part.material, list, part.leaf);
    });
    meshes.forEach((m) => g.add(m));
    treeTiles.push({ x: (+tx + 0.5) * TILE, z: (+tz + 0.5) * TILE, meshes });
  }
  for (const [kind, list] of byKind) {
    const c = models.trees[kind].card, mesh = im(c.geo, c.material, list, true);
    mesh.customDepthMaterial = c.depth;
    mesh.frustumCulled = false; // one mesh over the whole board
    g.add(mesh);
  }
  return g;
}
export function scatterHouses(points) {
  const walls = [], roofs = [], wallTone = [];
  const r = rng(91);
  for (const p of points) {
    const s = p.s || 1, ry = p.ry ?? r() * 6;
    const w = 0.9 * s, d = 0.7 * s, h = (0.55 + r() * 0.5) * s;
    walls.push(M(p.x, p.y + h / 2, p.z, w, h, d, ry));
    roofs.push(M(p.x, p.y + h + 0.18 * s, p.z, w * 0.78, 0.36 * s, d * 0.78, ry + Math.PI / 4));
    wallTone.push(r() < 0.7 ? C.wall : '#E3D6C2');
  }
  const g = new THREE.Group();
  g.add(instanced(new THREE.BoxGeometry(1, 1, 1), mat('#ffffff'), walls, wallTone));
  const roofGeo = new THREE.ConeGeometry(0.72, 1, 4); roofGeo.rotateY(Math.PI / 4);
  g.add(instanced(roofGeo, mat(C.roof), roofs));
  return g;
}
export function scatterBunkers(points) {
  const domes = points.map((p) => M(p.x, p.y, p.z, p.s || 1, (p.s || 1) * 0.62, p.s || 1));
  const geo = new THREE.SphereGeometry(0.42, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  return instanced(geo, mat('#C9C6BE'), domes);
}
export function cloud(seed = 1, size = 1) {
  const g = new THREE.Group();
  const r = rng(seed);
  const m = mat('#FFFFFF', { roughness: 1 });
  const n = 5 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const s = (0.8 + r() * 1.4) * size;
    const p = mesh(new THREE.IcosahedronGeometry(s, 1), m, (r() - 0.5) * 5 * size, (r() - 0.3) * 0.8 * size, (r() - 0.5) * 2.4 * size);
    p.scale.y = 0.62; p.receiveShadow = false; p.castShadow = false; g.add(p);
  }
  return g;
}
export function lamp(h = 1.2) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.025, 0.03, h, 5), mat(C.dark), 0, h / 2, 0));
  g.add(mesh(box(0.22, 0.05, 0.08), mat(C.dark), 0.08, h, 0));
  return g;
}
