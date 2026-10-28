// Moving and finishing pieces for the sets: tugboats, a port train on its track, waving flags, light towers,
// quay fenders and mooring lines, dolphins, a fishing boat, traffic cones, people who walk.
// Every animated prop takes a phase in 0..1 that repeats with the station loop.
import * as THREE from 'three';
import { mat, C, wordTexture, shadowed, person } from './kit.js';

const TAU = Math.PI * 2;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function m(geo, material, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; }

export function tugboat(color = '#C8352B') {
  const g = new THREE.Group();
  const sh = new THREE.Shape(); sh.moveTo(-0.9, -2); sh.lineTo(0.9, -2); sh.lineTo(0.95, 1.1); sh.quadraticCurveTo(0.6, 2.2, 0, 2.4); sh.quadraticCurveTo(-0.6, 2.2, -0.95, 1.1); sh.closePath();
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2 }); hull.rotateX(-Math.PI / 2); hull.translate(0, -0.45, 0);
  g.add(m(hull, mat(C.ink)));
  const deck = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false }); deck.rotateX(-Math.PI / 2); deck.scale(0.98, 1, 0.98); deck.translate(0, 0.45, 0);
  g.add(m(deck, mat(color)));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const t = m(new THREE.TorusGeometry(0.16, 0.07, 6, 10), mat('#1B1D21'), Math.cos(a) * 0.98, 0.25, Math.sin(a) * 1.5 + 0.2); t.rotation.y = -a; t.rotation.x = Math.PI / 2; g.add(t); }
  g.add(m(box(1.1, 0.75, 1.2), mat(C.white), 0, 0.95, 0.35));
  g.add(m(box(1.14, 0.22, 1.24), mat('#1C2A33', { roughness: 0.2 }), 0, 1.12, 0.35));
  g.add(m(box(0.4, 0.7, 0.4), mat(color), 0, 1.4, -0.45));
  g.add(m(box(0.42, 0.12, 0.42), mat(C.ink), 0, 1.8, -0.45));
  return shadowed(g);
}

// a freight train: diesel locomotive and flat wagons with cars; runs on a straight or curved track
export function rails(curve, segs = 200) {
  const g = new THREE.Group();
  const pts = curve.getSpacedPoints(segs);
  const sleeper = mat('#5B4B3E'), rail = mat('#8A8F94', { metalness: 0.5, roughness: 0.35 });
  const t = new THREE.Vector3();
  for (let i = 0; i < pts.length; i += 2) {
    curve.getTangentAt(i / (pts.length - 1), t);
    const s = m(box(0.7, 0.05, 0.14), sleeper, pts[i].x, pts[i].y + 0.03, pts[i].z); s.rotation.y = Math.atan2(t.x, t.z); g.add(s);
  }
  for (const off of [-0.22, 0.22]) {
    const rp = pts.map((p, i) => { curve.getTangentAt(i / (pts.length - 1), t); return new THREE.Vector3(p.x - t.z * off, p.y + 0.09, p.z + t.x * off); });
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp), segs, 0.03, 4, false);
    g.add(m(tube, rail));
  }
  return g;
}
export function locomotive(color = C.orange) {
  const g = new THREE.Group();
  g.add(m(box(0.62, 0.12, 2.6), mat(C.dark), 0, 0.24, 0));
  g.add(m(box(0.56, 0.62, 2.0), mat(color), 0, 0.62, -0.15));
  g.add(m(box(0.58, 0.68, 0.55), mat(C.white), 0, 0.68, 1.0));
  g.add(m(box(0.6, 0.18, 0.56), mat('#1C2A33', { roughness: 0.2 }), 0, 0.86, 1.0));
  g.add(m(box(0.58, 0.06, 2.62), mat(C.ink), 0, 0.33, 0));
  for (const z of [-0.9, 0.9]) for (const x of [-0.24, 0.24]) { const w = m(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), mat('#1B1D21'), x, 0.14, z); w.rotation.z = Math.PI / 2; g.add(w); }
  return shadowed(g);
}
export function flatWagon() {
  const g = new THREE.Group();
  g.add(m(box(0.6, 0.1, 2.4), mat('#5A5F66'), 0, 0.28, 0));
  for (const z of [-0.85, 0.85]) for (const x of [-0.24, 0.24]) { const w = m(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10), mat('#1B1D21'), x, 0.13, z); w.rotation.z = Math.PI / 2; g.add(w); }
  return shadowed(g);
}

// a flag on a pole; wave(flag, phase) bends its cloth
export function flag({ h = 2.6, w = 0.9, fh = 0.55, color = C.orange, word = null } = {}) {
  const g = new THREE.Group();
  g.add(m(new THREE.CylinderGeometry(0.03, 0.035, h, 6), mat('#C9CCCF', { metalness: 0.5, roughness: 0.4 }), 0, h / 2, 0));
  g.add(m(new THREE.SphereGeometry(0.05, 6, 4), mat('#C9CCCF'), 0, h + 0.02, 0));
  const geo = new THREE.PlaneGeometry(w, fh, 12, 3); geo.translate(w / 2, 0, 0);
  let map = null;
  if (word) map = wordTexture(word, { bg: color, fg: C.ink, w: 512, h: 320, font: '800 170px "Big Shoulders Display"' });
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : color, map, roughness: 0.8, side: THREE.DoubleSide }));
  cloth.position.set(0.03, h - fh / 2 - 0.05, 0); cloth.castShadow = true;
  g.add(cloth);
  g.userData.cloth = cloth;
  g.userData.base = Float32Array.from(geo.attributes.position.array);
  return g;
}
export function wave(f, phase, k = 1) {
  const c = f.userData.cloth, p = c.geometry.attributes.position, b = f.userData.base;
  for (let i = 0; i < p.count; i++) {
    const x = b[i * 3], y = b[i * 3 + 1];
    p.setZ(i, x * 0.28 * Math.sin(TAU * (phase * 2 * k) - x * 6 + y * 1.5) * k);
    p.setY(i, y - x * x * 0.05);
  }
  p.needsUpdate = true; c.geometry.computeVertexNormals();
}

export function lightTower(h = 5) {
  const g = new THREE.Group();
  g.add(m(new THREE.CylinderGeometry(0.07, 0.12, h, 6), mat('#B8BCC0', { metalness: 0.4 }), 0, h / 2, 0));
  g.add(m(box(0.9, 0.12, 0.3), mat(C.dark), 0, h, 0));
  for (const x of [-0.3, 0, 0.3]) g.add(m(box(0.22, 0.12, 0.05), mat('#FFF6DA', { emissive: '#FFF0C8', emissiveIntensity: 0.6 }), x, h - 0.02, 0.16));
  return shadowed(g);
}
export function fenders(len, step = 1.6) {
  const g = new THREE.Group();
  for (let z = -len / 2; z <= len / 2; z += step) { const f = m(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 8), mat('#1B1D21'), 0, 0, z); f.rotation.x = Math.PI / 2; f.rotation.z = Math.PI / 2; g.add(f); }
  return g;
}
export function quayEdge(len) {
  const g = new THREE.Group();
  g.add(m(box(0.22, 0.04, len), mat(C.yellow), 0, 0.02, 0));
  return g;
}
// a sagging rope between two points
export function mooringLine(a, b, sag = 0.6) {
  const mid = a.clone().lerp(b, 0.5); mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  return m(new THREE.TubeGeometry(curve, 16, 0.025, 4, false), mat('#2B2F33'));
}
export function dolphin() {
  const g = new THREE.Group();
  const body = m(new THREE.CapsuleGeometry(0.18, 0.9, 4, 8), mat('#6D7E8C', { roughness: 0.4 }), 0, 0, 0); body.rotation.x = Math.PI / 2; g.add(body);
  const fin = m(new THREE.ConeGeometry(0.1, 0.28, 4), mat('#5B6B78'), 0, 0.2, -0.05); fin.rotation.x = -0.4; g.add(fin);
  const tail = m(box(0.5, 0.04, 0.16), mat('#5B6B78'), 0, 0, -0.62); g.add(tail);
  return shadowed(g);
}
// jump arc for a dolphin over phase 0..1 within [t0, t0+len]
export function dolphinJump(d, phase, { x, z, heading = 0, t0 = 0.2, len = 0.22, dist = 3.2, h = 1.4 }) {
  const u = (phase - t0) / len;
  if (u < 0 || u > 1) { d.visible = false; return; }
  d.visible = true;
  const s = (u - 0.5) * dist;
  d.position.set(x + Math.sin(heading) * s, -0.2 + h * (1 - (2 * u - 1) ** 2), z + Math.cos(heading) * s);
  d.rotation.set(-(u - 0.5) * 2.2, heading, 0, 'YXZ');
}
export function fishingBoat() {
  const g = new THREE.Group();
  const sh = new THREE.Shape(); sh.moveTo(-0.55, -1.4); sh.lineTo(0.55, -1.4); sh.lineTo(0.6, 0.7); sh.quadraticCurveTo(0.3, 1.6, 0, 1.7); sh.quadraticCurveTo(-0.3, 1.6, -0.6, 0.7); sh.closePath();
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06 }); hull.rotateX(-Math.PI / 2); hull.translate(0, -0.25, 0);
  g.add(m(hull, mat('#2F6E8C')));
  g.add(m(box(0.7, 0.55, 0.7), mat(C.white), 0, 0.5, -0.3));
  g.add(m(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), mat(C.white), 0, 1.0, 0.5));
  return shadowed(g);
}
export function cone() {
  const g = new THREE.Group();
  g.add(m(new THREE.ConeGeometry(0.07, 0.2, 8), mat(C.orange), 0, 0.12, 0));
  g.add(m(box(0.16, 0.02, 0.16), mat(C.ink), 0, 0.01, 0));
  return g;
}
// people walking a closed loop, all alike so each loop moves everyone one gap
export function walkers(group, points, count = 4, color = C.ink, y = 0) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, y, z)), true);
  const L = curve.getLength();
  const items = Array.from({ length: count }, (_, i) => { const p = person(color); group.add(p); return { p, s0: (i / count) * L }; });
  const t = new THREE.Vector3();
  return (phase) => {
    for (const it of items) {
      const u = (((it.s0 + phase * (L / count)) % L) + L) % L / L;
      curve.getPointAt(u, it.p.position); curve.getTangentAt(u, t);
      it.p.rotation.y = Math.atan2(t.x, t.z);
      it.p.position.y = y + 0.02 * Math.abs(Math.sin(phase * TAU * 14 + it.s0));
    }
  };
}
export function lawn(w, d) { return m(box(w, 0.08, d), mat('#8FA864', { roughness: 0.95 }), 0, 0.04, 0); }
export function bayLines(n, step, len) {
  const g = new THREE.Group();
  for (let i = 0; i <= n; i++) g.add(m(box(0.04, 0.01, len), mat('#F4F4F0'), i * step, 0.005, 0));
  return g;
}
