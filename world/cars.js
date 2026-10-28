// Cars and the ships and buildings that move them. Cars, the car transporter and the container ship are Sketchfab
// models (world/models.js), the cars repainted per listing; the rest is built here.
import * as THREE from 'three';
import { mat, C, wordTexture, shadowed } from './kit.js';
import { rng } from './noise.js';
import * as M from './models.js';

export const CAR_LENGTH = 0.92; // model units; about 0.52 wide. A truck is about 2.3
export const CAR_COLORS = ['#F2F2EE', '#E4E2DA', '#1B1D21', '#A9AEB3', '#6C7177', '#2D4D78', '#9E2A2B', '#F2F2EE', '#1B1D21', '#A9AEB3', '#4D6A57', '#D9CFBF'];

// every model the world needs: Sketchfab cars, transporter, ship and containers (world/models.js)
export async function loadModels() {
  await M.loadModels();
  shipScene = M.ship;
}

// one car; `detail` 'lo' takes the light copy (far or many: train wagons, road traffic)
export function car(type = 'sedan', color = CAR_COLORS[0], detail = 'hi') {
  const g = new THREE.Group();
  g.userData.type = type;
  for (const p of M.cars[type][detail]) {
    const m = new THREE.Mesh(p.geo, p.paint ? M.paintMaterial(color) : p.material);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  return g;
}
// many parked cars from the light copies: per body type one InstancedMesh per part, the paint split by colour.
// slots [{x,y,z,ry,type,color}]
export function carLot(slots) {
  const g = new THREE.Group();
  const byType = new Map();
  for (const s of slots) { if (!byType.has(s.type)) byType.set(s.type, []); byType.get(s.type).push(s); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), e = new THREE.Euler();
  const fill = (im, list) => { list.forEach((s, i) => { p.set(s.x, s.y, s.z); q.setFromEuler(e.set(0, s.ry || 0, 0)); m4.compose(p, q, one); im.setMatrixAt(i, m4); }); im.castShadow = true; im.receiveShadow = true; g.add(im); };
  for (const [type, list] of byType) {
    for (const part of M.cars[type].lo) {
      if (!part.paint) { fill(new THREE.InstancedMesh(part.geo, part.material, list.length), list); continue; }
      const byColor = new Map();
      for (const s of list) { if (!byColor.has(s.color)) byColor.set(s.color, []); byColor.get(s.color).push(s); }
      for (const [color, cl] of byColor) fill(new THREE.InstancedMesh(part.geo, M.paintMaterial(color), cl.length), cl);
    }
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

// the Sketchfab ship has no radar node; kept so the stations can call it on any vessel
export function spinRadar(ship, phase) { if (ship.userData.radar) ship.userData.radar.rotation.y = phase * Math.PI * 2; }

// car transporter: a Hyundai Xcient tractor and a two-deck trailer (both Sketchfab, world/models.js) with six of
// our cars on the trailer's own slots; centred on its length so convoys keep their spacing
export function carTransporter(seed = 1) {
  const T = M.transporter, rig = new THREE.Group();
  for (const p of T.trailer) rig.add(m(p.geo, p.material));
  for (const p of T.cab) rig.add(m(p.geo, p.material, 0, 0, T.cabZ));
  const r = rng(seed);
  const types = ['sedan', 'suv', 'hatch', 'ev'];
  for (const s of T.slots) {
    const type = types[Math.floor(r() * 4)];
    const c = car(type, CAR_COLORS[Math.floor(r() * CAR_COLORS.length)], 'lo');
    c.scale.setScalar(Math.min(1, s.len / M.cars[type].size.z));
    c.position.copy(s.pos); c.rotation.x = -s.pitch;
    rig.add(c);
  }
  rig.position.z = -T.center;
  const g = new THREE.Group(); g.add(rig);
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

// The vessel: "Container Ship" by RM02 (Sketchfab, CC-BY 4.0), loaded by loadModels, credited in the site footer.
let shipScene = null;
// bow to +z, waterline at y = 0, length `len` model units; `draft` is the share of the model's height under water
export function containerShip({ len = 34, draft = SHIP_DRAFT } = {}) {
  const inner = shipScene.clone(true);
  inner.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(inner), s = box.getSize(new THREE.Vector3());
  if (s.x > s.z) { inner.rotation.y = Math.PI / 2; inner.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(inner); s = box.getSize(new THREE.Vector3()); }
  const k = len / s.z, c = box.getCenter(new THREE.Vector3());
  inner.scale.multiplyScalar(k);
  inner.position.set(-c.x * k, -box.min.y * k - s.y * k * draft, -c.z * k);
  if (SHIP_FLIP) inner.rotation.y += Math.PI;
  inner.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const g = new THREE.Group(); g.add(inner);
  g.userData = { len, w: s.x * k, h: s.y * k };
  return g;
}
const SHIP_FLIP = true, SHIP_DRAFT = 0.2; // the model is built stern to +x
