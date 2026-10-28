// Miniature kit for the relief model: trucks, containers, cranes, ships, planes, buildings, trees.
// Every piece is built from simple solids with flat shading, painted like a model railway layout.
import * as THREE from 'three';
import { rng } from './noise.js';
import * as models from './models.js';
import { fit } from './models.js';

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
export function stsCrane() {
  // ship-to-shore gantry crane; boom points -x (over the water)
  const g = new THREE.Group();
  const leg = box(0.22, 5.2, 0.22), beam = box(0.24, 0.24, 3.4);
  const red = mat(C.orange);
  for (const x of [-1.4, 1.4]) for (const z of [-1.5, 1.5]) g.add(mesh(leg, red, x, 2.6, z));
  for (const x of [-1.4, 1.4]) g.add(mesh(beam, red, x, 5.25, 0));
  g.add(mesh(box(3.0, 0.24, 0.24), red, 0, 3.6, -1.5));
  g.add(mesh(box(3.0, 0.24, 0.24), red, 0, 3.6, 1.5));
  // boom
  g.add(mesh(box(10.5, 0.3, 0.5), red, -3.2, 5.5, 0));
  g.add(mesh(box(0.25, 2.2, 0.25), red, 1.1, 6.6, 0));
  const tie = mesh(box(6.2, 0.06, 0.06), mat(C.dark), -2.0, 6.6, 0); tie.rotation.z = 0.33; g.add(tie);
  g.add(mesh(box(0.9, 0.8, 0.9), mat(C.white), 0.8, 4.9, 0)); // machinery house
  const trolley = new THREE.Group();
  trolley.add(mesh(box(0.7, 0.3, 0.6), mat(C.dark), 0, 5.2, 0));
  const rope = mesh(box(0.03, 1, 0.03), mat(C.dark), 0, 4.6, 0); trolley.add(rope);
  const spreader = new THREE.Group();
  spreader.add(mesh(box(0.5, 0.1, 1.7), mat(C.yellow), 0, 0, 0));
  const carried = containerBox(C.orange); carried.position.y = -0.48; spreader.add(carried);
  trolley.add(spreader);
  g.add(trolley);
  g.userData = { trolley, spreader, rope, carried };
  return shadowed(g);
}
export function setCrane(c, x, drop) {
  // x along boom (-9..1), drop = how far the spreader hangs below the trolley
  const { trolley, spreader, rope } = c.userData;
  trolley.position.x = x;
  spreader.position.y = 5.05 - drop;
  rope.scale.y = Math.max(0.05, drop);
  rope.position.y = 5.1 - drop / 2;
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
export function office({ w = 5, d = 4, floors = 4 } = {}) {
  const g = new THREE.Group();
  const fh = 0.7;
  for (let f = 0; f < floors; f++) {
    g.add(mesh(box(w, fh * 0.62, d), mat(C.glass, { roughness: 0.25 }), 0, f * fh + fh * 0.4, 0));
    g.add(mesh(box(w + 0.08, fh * 0.38, d + 0.08), mat(C.white), 0, f * fh + fh * 0.86, 0));
  }
  g.add(mesh(box(w + 0.1, 0.2, d + 0.1), mat(C.orange), 0, floors * fh + 0.1, 0));
  return shadowed(g);
}
export function shed({ w = 10, d = 6, h = 2, color = C.white, roof = C.grey } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(w, h, d), mat(color), 0, h / 2, 0));
  const r = mesh(box(w + 0.3, 0.2, d + 0.3), mat(roof), 0, h + 0.1, 0); g.add(r);
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

export function scatterTrees(points) {
  // points: [{x,y,z,kind,s}] kind: olive | cypress | pine
  const g = new THREE.Group();
  const trunks = [], olives = [], cyps = [], pinesA = [], pinesB = [];
  const oliveTone = [], cypTone = [], pineTone = [];
  const r = rng(77);
  for (const p of points) {
    const s = p.s || 1;
    if (p.kind === 'olive') {
      trunks.push(M(p.x, p.y + 0.18 * s, p.z, s, s, s));
      olives.push(M(p.x, p.y + 0.55 * s, p.z, 1.15 * s, 0.75 * s, 1.15 * s, r() * 6));
      oliveTone.push(r() < 0.5 ? C.olive : '#8E9966');
    } else if (p.kind === 'cypress') {
      cyps.push(M(p.x, p.y + 0.9 * s, p.z, s, s, s, r() * 6)); cypTone.push(r() < 0.5 ? C.cypress : '#4A6644');
    } else {
      pinesA.push(M(p.x, p.y + 0.75 * s, p.z, s, s, s, r() * 6)); pinesB.push(M(p.x, p.y + 1.25 * s, p.z, 0.7 * s, 0.75 * s, 0.7 * s, r() * 6));
      pineTone.push(r() < 0.5 ? C.pine : '#5B7A50');
    }
  }
  if (trunks.length) g.add(instanced(cyl(0.05, 0.07, 0.36, 5), mat('#6B5440'), trunks));
  if (olives.length) g.add(instanced(new THREE.IcosahedronGeometry(0.42, 0), mat('#ffffff'), olives, oliveTone));
  if (cyps.length) g.add(instanced(new THREE.ConeGeometry(0.2, 1.8, 6), mat('#ffffff'), cyps, cypTone));
  if (pinesA.length) {
    g.add(instanced(new THREE.ConeGeometry(0.55, 1.2, 7), mat('#ffffff'), pinesA, pineTone));
    g.add(instanced(new THREE.ConeGeometry(0.55, 1.0, 7), mat('#ffffff'), pinesB, pineTone));
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
