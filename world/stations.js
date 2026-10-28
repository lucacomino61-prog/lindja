// The five stops of the LINDJA film, each a miniature set with its own looping life.
// update(tau) receives the station's local time in seconds (0..PERIOD), so every loop closes on itself.
import * as THREE from 'three';
import { STATIONS, height } from './geo.js';
import * as K from './kit.js';
import * as V from './cars.js';
import * as P from './props.js';
import { roadK, roadA, onRoad } from './terrain.js';

export const PERIOD = 6;
const TAU = Math.PI * 2;
const wave = (tau, k = 1, ph = 0) => 0.5 - 0.5 * Math.cos(TAU * k * tau / PERIOD + ph);

function place(obj, x, z, { y = null, ry = 0 } = {}) { obj.position.set(x, y ?? height(x, z), z); obj.rotation.y = ry; return obj; }
function anchorAt(group, id, x, y, z) { const a = new THREE.Object3D(); a.position.set(x, y, z); a.name = id; group.add(a); return { id, obj: a }; }

export function nearestS(curve, x, z) {
  const L = curve.getLength(), n = 3000; let best = 1e9, bs = 0; const p = new THREE.Vector3();
  for (let i = 0; i <= n; i++) { curve.getPointAt(i / n, p); const d = Math.hypot(p.x - x, p.z - z); if (d < best) { best = d; bs = (i / n) * L; } }
  return bs;
}
// Vehicles on a road. ring: a closed track, each loop moves every vehicle one gap (all must look alike);
// chain: a long line centred on `center` moving one gap per loop.
function convoy(group, curve, { center = 0, half = 60, speed = 4, lane = 0.45, make, dir = 1, ring = false, count = 4 }) {
  const L = curve.getLength();
  let spacing, n, s0;
  if (ring) { n = count; spacing = L / n; speed = spacing / PERIOD; s0 = 0; }
  else { spacing = speed * PERIOD; n = Math.ceil((2 * half) / spacing) + 2; s0 = center - half - spacing; }
  const items = [];
  for (let i = 0; i < n; i++) { const v = make(i); group.add(v); items.push({ v, s0: s0 + i * spacing }); }
  return (tau) => {
    for (const it of items) {
      let s = it.s0 + dir * speed * tau;
      if (ring) s = ((s % L) + L) % L;
      const p = onRoad(curve, s, lane * dir);
      it.v.position.set(p.x, p.y, p.z);
      it.v.rotation.y = p.heading + (dir < 0 ? Math.PI : 0);
    }
  };
}
function path3(points, closed = false) { return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'centripetal', 0.2); }
// things on a 3D path (ramps, water); identical things, one gap per loop
function pathRing(group, curve, { count, make, bob = 0 }) {
  const L = curve.getLength(), spacing = L / count, speed = spacing / PERIOD;
  const items = Array.from({ length: count }, (_, i) => { const v = make(i); group.add(v); return { v, s0: i * spacing }; });
  const t = new THREE.Vector3();
  return (tau) => {
    for (const it of items) {
      const u = ((((it.s0 + speed * tau) % L) + L) % L) / L;
      curve.getPointAt(u, it.v.position); curve.getTangentAt(u, t);
      if (bob) it.v.position.y += bob * Math.sin((TAU * tau / PERIOD) * 2 + it.s0);
      it.v.rotation.set(-Math.asin(Math.max(-1, Math.min(1, t.y))), Math.atan2(t.x, t.z), 0, 'YXZ');
    }
  };
}
// one thing passing once per loop along a straight line (off-screen at both ends)
function passer(group, a, b, make) {
  const v = make(); group.add(v);
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), heading = Math.atan2(B.x - A.x, B.z - A.z);
  return (tau) => { v.position.lerpVectors(A, B, tau / PERIOD); v.rotation.y = heading; };
}
function quay(g, x, y, z0, z1, side) {
  const len = z1 - z0, zc = (z0 + z1) / 2;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 4.4, len), K.mat(K.C.concrete)); wall.position.set(x - side, y - 2.2, zc); wall.receiveShadow = true; g.add(wall);
  const edge = P.quayEdge(len); edge.position.set(x - side * 0.3, y, zc); g.add(edge);
  const f = P.fenders(len - 2); f.position.set(x + side * 0.06, y - 0.55, zc); g.add(f);
  g.add(place(K.bollardsRow(len - 4), x - side * 0.6, zc, { y }));
}
function brandFlags(g, xs, z, y, n0 = 0) {
  return xs.map((x, i) => { const f = P.flag({ color: (i + n0) % 2 ? K.C.ink : K.C.orange, word: (i + n0) % 2 ? null : 'L' }); g.add(place(f, x, z, { y })); return f; });
}

// ---------------------------------------------------------------- 0 · Incheon: the yard where cars are chosen
function yard() {
  const st = STATIONS[0];
  const g = new THREE.Group(); g.name = 'kore';
  const y = st.pad;
  const slots = [];
  let row = 0;
  for (let zr = -52; zr < -24; zr += 1.1) {
    const pair = row % 2; row++;
    if (row % 3 === 0) { zr += 1.4; continue; } // aisle
    for (let x = 296; x < 328; x += 0.62) {
      const k = Math.floor(Math.abs(x * 13 + zr * 7) * 1000) % 97;
      if (k < 7) continue;
      slots.push({ x, y, z: zr, ry: pair ? Math.PI : 0, type: ['suv', 'sedan', 'suv', 'ev', 'hatch', 'suv'][k % 6], color: V.CAR_COLORS[k % V.CAR_COLORS.length] });
    }
  }
  g.add(V.carLot(slots));
  for (const [x, z] of [[295, -54], [329, -54], [295, -22], [329, -22]]) g.add(place(P.lightTower(5.5), x, z, { y }));
  const hall = K.shed({ w: 12, d: 6, h: 2.4, color: K.C.white, roof: '#3D6FA6' }); g.add(place(hall, 338, -30, { y, ry: Math.PI / 2 }));
  for (let i = 0; i < 3; i++) { const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 1.6), K.mat(K.C.dark)); door.position.set(334.96, y + 0.8, -34 + i * 4); door.castShadow = true; g.add(door); }
  const ko = K.wordTexture('중고차 수출 · LINDJA', { bg: '#3D6FA6', fg: '#FFFFFF', w: 2048, h: 256, font: '700 140px "Malgun Gothic", "Big Shoulders Display", sans-serif' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.0), new THREE.MeshStandardMaterial({ map: ko, roughness: 0.7 })); sign.position.set(334.95, y + 2.02, -30); sign.rotation.y = -Math.PI / 2; g.add(sign);
  const gate = V.koreanGate(5.4); g.add(place(gate, 322, -16, { y }));
  const office = K.office({ w: 5, d: 4, floors: 4 }); g.add(place(office, 342, -16, { y }));
  const flags = brandFlags(g, [317.5, 318.6, 325.4, 326.5], -15.2, y);
  const lane = path3([[334.4, y, -26], [331, y, -22], [326, y, -19.5], [322, y, -17], [322, y, -8], [322, y, 4], [322, y, 16]]);
  const lanes = pathRing(g, lane, { count: 3, make: () => V.car('suv', '#F2F2EE') });
  const sK = nearestS(roadK, 300, 22);
  const tr = convoy(g, roadK, { center: sK, half: 50, speed: 3.2, make: (i) => V.carTransporter(i + 2) });
  const back = convoy(g, roadK, { center: sK, half: 50, speed: 3.6, dir: -1, make: () => V.carTransporter(1) });
  const inspectors = P.walkers(g, [[331, -24], [331, -36], [329.4, -36], [329.4, -24]], 3, K.C.ink, y);
  const buyers = P.walkers(g, [[312, -23.4], [300, -23.4], [300, -22.6], [312, -22.6]], 2, '#2D4D78', y);
  const apts = []; for (let i = 0; i < 9; i++) { const x = 352 + (i % 3) * 5, z = -60 + Math.floor(i / 3) * 6; apts.push({ x, y: height(x, z), z, ry: 0.15 }); }
  g.add(V.apartmentBlocks(apts));
  const anchors = [
    anchorAt(g, 'kore-lot', 316, 2, -27),
    anchorAt(g, 'kore-hall', 326, 2, -26),
    anchorAt(g, 'kore-gate', 322, 4.5, -16),
  ];
  const update = (tau) => {
    const ph = tau / PERIOD;
    lanes(tau); tr(tau); back(tau); inspectors(ph); buyers(ph);
    flags.forEach((f, i) => P.wave(f, ph + i * 0.13));
  };
  return { id: 'kore', group: g, anchors, update };
}

// ---------------------------------------------------------------- 1 · Incheon port: loading the car carrier
function incheon() {
  const st = STATIONS[1];
  const g = new THREE.Group(); g.name = 'port';
  const y = st.pad;
  quay(g, st.quay, y, -6, 68, 1);
  const ship = V.containerShip({ len: 34 });
  ship.position.set(st.quay - ship.userData.w / 2 - 0.4, 0, 28); ship.rotation.y = Math.PI; g.add(ship);
  const box = P.openContainer(); g.add(place(box, 225.4, 47.6, { y }));
  for (const [sz, bz] of [[14, 10], [20, 18], [36, 38], [42, 46]]) g.add(P.mooringLine(new THREE.Vector3(st.quay - 0.6, 1.1, sz), new THREE.Vector3(st.quay + 0.6, y + 0.2, bz), 0.4));
  const slots = [];
  for (const x0 of [227.2, 229.8, 232.4]) for (let j = 0; j < 40; j++) { if ((j * 3 + Math.round(x0)) % 9 < 1) continue; slots.push({ x: x0, y, z: 2 + j * 1.0, ry: 0, type: ['suv', 'sedan', 'ev', 'hatch', 'suv'][(j + Math.round(x0)) % 5], color: V.CAR_COLORS[(j * 7 + Math.round(x0)) % V.CAR_COLORS.length] }); }
  g.add(V.carLot(slots));
  const up = path3([[238, y + 0.02, 62], [233, y + 0.02, 56], [227, y + 0.02, 52.4], [225.4, y + 0.03, 50.2], [225.4, y + 0.03, 48.4], [225.4, y + 0.03, 47.0]]);
  const loaders = pathRing(g, up, { count: 4, make: () => V.car('suv', '#1B1D21') });
  const cranes = [16, 30].map((z) => { const c = K.stsCrane(); c.position.set(st.quay + 2.4, y, z); g.add(c); return c; });
  const term = K.shed({ w: 10, d: 6, h: 2.2, color: K.C.white, roof: '#3D6FA6' }); g.add(place(term, 258, 10, { y }));
  for (let z = 2; z <= 62; z += 12) g.add(place(P.lightTower(5), 235.2, z, { y }));
  const tug = pathRing(g, path3([[214, 0.15, 6], [208, 0.15, 12], [212, 0.15, 20], [216.6, 0.15, 12]], true), { count: 1, make: () => P.tugboat(), bob: 0.05 });
  const dockers = P.walkers(g, [[224.2, 49], [224.2, 56], [225, 56], [225, 49]], 2, '#F2702A', y);
  const gulls = [0, 1].map(() => { const b = V.gull(); g.add(b); return b; });
  const anchors = [
    anchorAt(g, 'port-ship', 217, 1.6, 34),
    anchorAt(g, 'port-ramp', 222.9, 2, 48),
    anchorAt(g, 'port-quay', 230, 2, 40),
  ];
  const update = (tau) => {
    const ph = tau / PERIOD, a = TAU * ph;
    loaders(tau); tug(tau); dockers(ph);
    ship.position.y = 0.03 * Math.sin(a);
    V.spinRadar(ship, ph * 2);
    cranes.forEach((c, i) => K.setCrane(c, THREE.MathUtils.lerp(-7.4, 0.2, wave(tau, 1, i * 2)), 1 + 2.6 * wave(tau, 2, i)));
    gulls.forEach((b, i) => { b.position.set(214 + 6 * Math.cos(a + i * 3), 10 + i, 30 + 9 * Math.sin(a + i * 3)); b.rotation.y = -(a + i * 3); b.children.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * (0.25 + 0.35 * Math.sin(a * 6 + i)); }); });
  };
  return { id: 'port', group: g, anchors, update };
}

// ---------------------------------------------------------------- 2 · at sea
function sea() {
  const g = new THREE.Group(); g.name = 'deti';
  const ship = V.containerShip({ len: 34 });
  ship.rotation.y = -Math.PI / 2; // heading west (-x): Korea to Albania
  g.add(ship);
  const wake = V.foam(18, 5.6); wake.rotation.y = -Math.PI / 2; wake.position.set(17, 0, 0); g.add(wake);
  const bow = V.foam(4, 4.6); bow.rotation.y = Math.PI / 2; bow.position.set(-17.6, 0, 0); g.add(bow);
  const isle = V.lighthouseIslet(); isle.position.set(-34, 0.2, -24); g.add(isle);
  const lamp = isle.children.find((o) => o.material?.emissiveIntensity === 0.6);
  const far = V.containerShip({ len: 27 }); far.rotation.y = Math.PI / 2 - 0.15; far.position.set(80, 0, -66); g.add(far);
  const fisher = passer(g, [-70, 0.1, 34], [60, 0.1, 22], () => P.fishingBoat());
  const dolphins = [0, 1, 2].map(() => { const d = P.dolphin(); g.add(d); return d; });
  const gulls = [0, 1, 2].map(() => { const b = V.gull(); g.add(b); return b; });
  const anchors = [anchorAt(g, 'deti-ship', 2, 6, 0), anchorAt(g, 'deti-isle', -12, 2, 9)];
  const update = (tau) => {
    const ph = tau / PERIOD, a = TAU * ph;
    ship.position.y = 0.12 * Math.sin(a); ship.rotation.z = 0.012 * Math.sin(a + 0.6);
    V.spinRadar(ship, ph * 2); V.spinRadar(far, ph);
    for (const w of [wake, bow]) w.children.forEach((s) => { const k = 0.75 + 0.35 * Math.sin(a * 2 + s.userData.ph); s.scale.set(k, k, k); });
    if (lamp) lamp.material.emissiveIntensity = 0.4 + 1.2 * Math.max(0, Math.sin(a * 3));
    fisher(tau);
    P.dolphinJump(dolphins[0], ph, { x: -12, z: 9, heading: -Math.PI / 2, t0: 0.12, len: 0.2 });
    P.dolphinJump(dolphins[1], ph, { x: -15, z: 10.5, heading: -Math.PI / 2, t0: 0.2, len: 0.2 });
    P.dolphinJump(dolphins[2], ph, { x: -6, z: 8.5, heading: -Math.PI / 2, t0: 0.58, len: 0.2 });
    gulls.forEach((b, i) => {
      const p2 = a + i * 2.1;
      b.position.set(-4 + 7 * Math.cos(p2), 11 + 1.2 * Math.sin(2 * p2) + i, 4 * Math.sin(p2) + i * 2);
      b.rotation.set(0, -p2, 0.4 * Math.sin(2 * p2));
      b.children.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * (0.25 + 0.35 * Math.sin(6 * a + i)); });
    });
  };
  return { id: 'deti', group: g, anchors, update };
}

// ---------------------------------------------------------------- 3 · Durrës: unloading, customs, inspection
function durres() {
  const st = STATIONS[3];
  const g = new THREE.Group(); g.name = 'durres';
  const y = st.pad;
  quay(g, st.quay, y, -14, 60, -1);
  const ship = V.containerShip({ len: 34 }); ship.position.set(st.quay + ship.userData.w / 2 + 0.4, 0, 26); g.add(ship);
  const box = P.openContainer(); g.add(place(box, -226, 6.2, { y, ry: Math.PI }));
  for (const [sz, bz] of [[12, 8], [18, 16], [34, 36], [40, 44]]) g.add(P.mooringLine(new THREE.Vector3(st.quay + 0.6, 1.1, sz), new THREE.Vector3(st.quay - 0.6, y + 0.2, bz), 0.4));
  const off = path3([[-226, y + 0.03, 6.8], [-226, y + 0.03, 5.4], [-226, y + 0.03, 3.6], [-227.4, y + 0.02, 0.4], [-228, y + 0.02, -3], [-234, y + 0.02, -5], [-240, y + 0.02, -5], [-245, y + 0.02, -2], [-249, y + 0.02, 4], [-253, y + 0.02, 6.4]]);
  const unloaders = pathRing(g, off, { count: 4, make: () => V.car('ev', '#F2F2EE') });
  const slots = [];
  for (const x0 of [-229.2, -231.8, -234.4]) for (let j = 0; j < 42; j++) { if ((j * 5 + Math.round(-x0)) % 11 < 1.5) continue; slots.push({ x: x0, y, z: 10 + j * 1.0, ry: Math.PI, type: ['suv', 'ev', 'sedan', 'suv', 'hatch'][(j + Math.round(-x0)) % 5], color: V.CAR_COLORS[(j * 5 + Math.round(-x0)) % V.CAR_COLORS.length] }); }
  g.add(V.carLot(slots));
  const cleared = [];
  for (let zr = -14; zr < 2; zr += 1.15) for (let x = -264; x < -247; x += 0.62) { const k = Math.floor(Math.abs(x * 11 + zr * 5) * 100) % 89; if (k < 8) continue; cleared.push({ x, y, z: zr, ry: (Math.round(zr * 10) % 2) ? 0 : Math.PI, type: ['suv', 'sedan', 'ev', 'hatch'][k % 4], color: V.CAR_COLORS[k % V.CAR_COLORS.length] }); }
  g.add(V.carLot(cleared));
  for (let i = 0; i < 4; i++) g.add(place(V.carTransporter(20 + i), -246.6 + i * 1.3, 18, { y, ry: Math.PI }));
  const can = K.customsCanopy({ lanes: 4, laneW: 1.4, depth: 4.4, sign: 'DURRËS · DOGANA' }); can.position.set(-240, y, -5); can.rotation.y = Math.PI / 2; g.add(can);
  const shed = K.shed({ w: 8, d: 5, h: 2.2, color: K.C.white, roof: K.C.orange }); g.add(place(shed, -253, 6, { y }));
  const tex = K.wordTexture('KOLAUDIM', { bg: K.C.orange, fg: K.C.ink, w: 1024, h: 200, font: '800 150px "Big Shoulders Display"', tracking: 6 });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.78), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })); sg.position.set(-253, y + 1.7, 8.53); g.add(sg);
  // the port railway: a long string of car wagons shunting one wagon-length per loop
  const track = new THREE.LineCurve3(new THREE.Vector3(-238.6, y, -60), new THREE.Vector3(-238.6, y, 90));
  g.add(P.rails(track, 160));
  const wagonLen = 2.5, nW = 44;
  const wagons = [];
  for (let i = 0; i < nW; i++) {
    const w = i === nW - 1 ? P.locomotive() : P.flatWagon();
    if (i < nW - 1) for (const z of [-0.55, 0.55]) { const c = V.car('sedan', '#F2F2EE', 'lo'); c.scale.setScalar(0.85); c.position.set(0, 0.33, z); w.add(c); }
    g.add(w); wagons.push(w);
  }
  const sA = nearestS(roadA, -262, 45);
  const tr = convoy(g, roadA, { center: sA, half: 45, speed: 3.4, make: (i) => V.carTransporter(i + 7) });
  const traffic = convoy(g, roadA, { center: sA, half: 45, speed: 4.2, dir: -1, make: () => V.car('van', '#F2F2EE', 'lo') });
  const cr = [18, 32].map((z) => { const c = K.stsCrane(); c.position.set(st.quay - 2.4, y, z); c.rotation.y = Math.PI; g.add(c); return c; });
  for (let z = -10; z <= 58; z += 12) g.add(place(P.lightTower(5), -236.4, z, { y }));
  const tug = pathRing(g, path3([[-214, 0.15, 2], [-208, 0.15, 8], [-212, 0.15, 16], [-216.6, 0.15, 8]], true), { count: 1, make: () => P.tugboat('#2F6E8C'), bob: 0.05 });
  const officers = P.walkers(g, [[-237.2, -2.6], [-237.2, -7.4], [-236.6, -7.4], [-236.6, -2.6]], 2, '#2D4D78', y);
  const drivers = P.walkers(g, [[-226, 6], [-226, 14], [-227, 14], [-227, 6]], 2, '#F2702A', y);
  const flags = brandFlags(g, [-244.6, -243.6], 11, y);
  const anchors = [
    anchorAt(g, 'durres-ship', -226, 2, 5),
    anchorAt(g, 'durres-customs', -240, 4, -5),
    anchorAt(g, 'durres-kolaudim', -232, 2, 20),
  ];
  const update = (tau) => {
    const ph = tau / PERIOD, a = TAU * ph;
    unloaders(tau); tr(tau); traffic(tau); tug(tau); officers(ph); drivers(ph);
    ship.position.y = 0.03 * Math.sin(a);
    V.spinRadar(ship, ph * 2);
    cr.forEach((c, i) => K.setCrane(c, THREE.MathUtils.lerp(-7.4, 0.2, wave(tau, 1, i * 2.4)), 1 + 2.6 * wave(tau, 2, i)));
    wagons.forEach((w, i) => { w.position.set(-238.6, y + 0.02, 80 - i * wagonLen - ph * wagonLen); w.rotation.y = Math.PI; });
    flags.forEach((f, i) => P.wave(f, ph + i * 0.2));
  };
  return { id: 'durres', group: g, anchors, update };
}

// ---------------------------------------------------------------- 4 · Tirana showroom
function tirana() {
  const st = STATIONS[4];
  const g = new THREE.Group(); g.name = 'salloni';
  const y = st.pad;
  const room = V.showroom({ w: 16, d: 8, h: 3.6 }); g.add(place(room, -338, -42, { y }));
  const pods = room.userData.pods.map((p) => p.clone().add(room.position));
  let turnCar = null;
  [['ev', '#A9AEB3'], ['lux', '#F2F2EE'], ['sedan', '#1B1D21'], ['suv', '#2D4D78']].forEach(([t, c], i) => {
    const car = V.car(t, c); car.scale.setScalar(1.2);
    car.position.set(pods[i].x, y + room.userData.floorY, pods[i].z); car.rotation.y = -0.6 + i * 0.25;
    g.add(car); if (i === 1) turnCar = car;
  });
  // the hero car outside, turning on its podium by the entrance
  const hero = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.3, 0.18, 36), K.mat('#2A2E33', { roughness: 0.35 })); base.castShadow = true; base.receiveShadow = true; hero.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.03, 6, 48), K.mat(K.C.orange, { emissive: K.C.orange, emissiveIntensity: 0.5 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.09; hero.add(ring);
  const heroCar = V.car('ev', '#FF4F12'); heroCar.scale.setScalar(1.3); heroCar.position.y = 0.09; hero.add(heroCar);
  g.add(place(hero, -329.5, -37.6, { y }));
  // brand totem
  const totem = new THREE.Group();
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.4, 0.28), K.mat(K.C.orange)); pylon.position.y = 2.2; pylon.castShadow = true; totem.add(pylon);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 1536; const cx = cv.getContext('2d'); cx.fillStyle = K.C.orange; cx.fillRect(0, 0, 256, 1536); cx.translate(128, 768); cx.rotate(-Math.PI / 2); cx.fillStyle = K.C.ink; cx.font = '800 210px "Big Shoulders Display"'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('LINDJA', 0, 12);
  const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace;
  for (const side of [1, -1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 3.8), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.6 })); d.position.set(0, 2.2, side * 0.145); if (side < 0) d.rotation.y = Math.PI; totem.add(d); }
  g.add(place(totem, -326, -40, { y }));
  // display lot with painted bays and price boards; lawns, olives, cypresses
  const slots = [];
  for (let i = 0; i < 24; i++) for (const [zr, ry, off] of [[-32.4, Math.PI, 0], [-28.8, 0, 3], [-27.2, Math.PI, 5], [-23.6, 0, 7]]) {
    if ((i * 3 + off) % 7 === 0) continue;
    slots.push({ x: -351.6 + i * 0.8, y, z: zr, ry, type: ['suv', 'sedan', 'ev', 'hatch', 'lux'][(i + off) % 5], color: V.CAR_COLORS[(i * 5 + off) % V.CAR_COLORS.length] });
  }
  g.add(V.carLot(slots));
  for (const z of [-32.4, -28.8, -27.2, -23.6]) { const b = P.bayLines(24, 0.8, 1.1); b.position.set(-352, y + 0.01, z); g.add(b); }
  for (let i = 1; i < 24; i += 3) g.add(place(V.priceBoard(), -351.6 + i * 0.8, -33.5, { y }));
  for (const [x, z, w, d] of [[-338, -21.2, 30, 1.6], [-357, -30, 1.6, 14]]) g.add(place(P.lawn(w, d), x, z, { y }));
  const trees = []; for (let x = -352; x <= -324; x += 3.2) trees.push({ x, y: y + 0.08, z: -21.2, kind: 'olive', s: 1.1 });
  for (let x = -372; x <= -300; x += 2.3) trees.push({ x, y: height(x, -5), z: -5, kind: 'cypress', s: 1.05 });
  g.add(K.scatterTrees(trees));
  const flags = brandFlags(g, [-351, -347.5, -344, -332, -328.5], -36.3, y);
  const svc = K.shed({ w: 9, d: 6, h: 2.2, color: K.C.white, roof: K.C.grey }); g.add(place(svc, -316, -52, { y }));
  for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 0.08), K.mat(K.C.dark)); d.position.set(-319 + i * 3, y + 0.8, -48.98); g.add(d); }
  const stex = K.wordTexture('SERVIS', { bg: null, fg: K.C.ink, w: 1024, h: 256, font: '800 200px "Big Shoulders Display"', tracking: 8 });
  const ss = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshStandardMaterial({ map: stex, transparent: true, roughness: 0.7 })); ss.position.set(-316, y + 1.95, -48.96); g.add(ss);
  const svcCar = V.car('suv', '#6C7177'); g.add(svcCar);
  // test-drive loop with cones
  const pts = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; pts.push(new THREE.Vector3(-318 + 8.5 * Math.cos(a), 0, -26 + 4.2 * Math.sin(a))); }
  const loop = new THREE.CatmullRomCurve3(pts, true);
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, y + 0.03, p.z)), true), 200, 0.62, 4, true);
  const road = new THREE.Mesh(tube, K.mat(K.C.asphalt)); road.receiveShadow = true; g.add(road);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; g.add(place(P.cone(), -318 + 6.9 * Math.cos(a), -26 + 2.8 * Math.sin(a), { y })); }
  const testers = convoy(g, loop, { ring: true, count: 2, lane: 0, make: () => V.car('lux', '#1B1D21') });
  const customers = P.walkers(g, [[-341, -35.6], [-333, -35.6], [-329, -36.8], [-333, -37.2], [-341, -37]], 4, '#2D4D78', y);
  const staff = P.walkers(g, [[-343, -40.2], [-335, -40.2], [-335, -39.6], [-343, -39.6]], 2, K.C.ink, y + 0.3);
  const anchors = [
    anchorAt(g, 'salloni-room', -340, 3.5, -40),
    anchorAt(g, 'salloni-lot', -345, 2, -30),
    anchorAt(g, 'salloni-drive', -329.5, 2, -37.6),
  ];
  const update = (tau) => {
    const ph = tau / PERIOD;
    hero.rotation.y = TAU * ph;
    turnCar.rotation.y = -0.35 + TAU * ph;
    testers(tau); customers(ph); staff(ph);
    flags.forEach((f, i) => P.wave(f, ph + i * 0.17));
    const k = wave(tau, 1);
    svcCar.position.set(-316, y, -49.4 + 3.2 * k); svcCar.rotation.y = 0;
  };
  return { id: 'salloni', group: g, anchors, update };
}

export function buildStations() { return [yard(), incheon(), sea(), durres(), tirana()]; }
