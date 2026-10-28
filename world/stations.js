// The five stops of the LINDJA film, each a miniature set with its own looping life.
// update(tau) receives the station's local time in seconds (0..PERIOD), so every loop closes on itself.
import * as THREE from 'three';
import { STATIONS, height } from './geo.js';
import * as K from './kit.js';
import * as V from './cars.js';
import * as P from './props.js';
import { roadK, roadA, onRoad, ROAD } from './terrain.js';
const { inner: FAST, outer: SLOW } = ROAD.lanes; // traffic lanes, right of the direction of travel

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
// A closed truck circuit for crane work. The trucks, a gap apart, stop and go together and advance one gap per loop,
// so one of them waits under the crane across the loop seam (tau 4.7 → 0.6) while the spreader works it. Each carries
// the port's container on one part of the circuit only: from the shed (s = 0) to the crane when loading, from the
// crane back into the shed when unloading; the shed hides the swap.
function truckRing(group, curve, { count, stop, mode, make }) {
  const L = curve.getLength(), G = L / count, sStop = nearestS(curve, stop[0], stop[1]);
  const items = Array.from({ length: count }, (_, i) => { const v = make(); group.add(v); return { v, i }; });
  const t = new THREE.Vector3();
  return (tau) => {
    const prog = THREE.MathUtils.smoothstep(tau, 0.6, 4.7);
    for (const { v, i } of items) {
      const s = (((sStop + (i - count) * G + G * prog) % L) + L) % L;
      curve.getPointAt(s / L, v.position); curve.getTangentAt(s / L, t);
      v.rotation.set(0, Math.atan2(t.x, t.z), 0);
      const at = Math.min(Math.abs(s - sStop), L - Math.abs(s - sStop)) < 0.02;
      v.userData.box.visible = mode === 'load' ? (at ? tau >= 3 : s < sStop) : (at ? tau < 3 : s > sStop);
    }
  };
}
// identical vehicles along an open route, one gap (speed x PERIOD) apart, one gap per loop; hidden before the start
// and past the end (both off-camera or inside a building)
function chainOnce(group, curve, { speed, make }) {
  const L = curve.getLength(), G = speed * PERIOD, n = Math.ceil(L / G) + 1;
  const items = Array.from({ length: n }, (_, i) => { const v = make(); group.add(v); return { v, s0: (i - 1) * G }; });
  return (tau) => {
    for (const it of items) {
      const s = it.s0 + speed * tau;
      it.v.visible = s >= 0 && s <= L;
      if (!it.v.visible) continue;
      const p = onRoad(curve, s, 0);
      it.v.position.set(p.x, p.y, p.z); it.v.rotation.y = p.heading;
    }
  };
}
// a two-lane slip road on the terrain, with edge lines
function slipRoad(curve, width) {
  const n = Math.ceil(curve.getLength() / 0.5), pts = curve.getSpacedPoints(n), t = new THREE.Vector3();
  const road = [], lines = [];
  pts.forEach((p, i) => {
    curve.getTangentAt(i / n, t);
    const sx = -t.z, sz = t.x, y = height(p.x, p.z) + 0.078;
    road.push([p.x + sx * width / 2, y, p.z + sz * width / 2], [p.x - sx * width / 2, y, p.z - sz * width / 2]);
    for (const o of [width / 2 - 0.08, -(width / 2 - 0.08)]) lines.push([p.x + sx * (o + 0.015), y + 0.004, p.z + sz * (o + 0.015)], [p.x + sx * (o - 0.015), y + 0.004, p.z + sz * (o - 0.015)]);
  });
  const ribbon = (vs, every = 2, k = 2) => {
    const g = new THREE.BufferGeometry(), idx = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j += 2) { const a = i * every * (k / 2) + j, b = a + 1, c = a + every * (k / 2), d = c + 1; idx.push(a, b, c, b, d, c); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(vs.flat(), 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const grp = new THREE.Group();
  const r = new THREE.Mesh(ribbon(road), new THREE.MeshStandardMaterial({ color: '#3A3D41', roughness: 0.9, side: THREE.DoubleSide })); r.receiveShadow = true; grp.add(r);
  const l = new THREE.Mesh(ribbon(lines, 2, 4), new THREE.MeshStandardMaterial({ color: '#E8E6DF', roughness: 0.8, side: THREE.DoubleSide })); l.receiveShadow = true; grp.add(l);
  return grp;
}
// Identical vehicles along a 3D route (ramps included), one gap per loop, hidden before the start and past the end.
// Over the first `fastUntil` units they run `factor` times faster and further apart (the highway), easing down to
// loading pace for the quay and the ramp. Interleave several lines with `offset` (a fraction of the gap) for a mixed queue.
function chain3(group, curve, { speed, make, offset = 0, fastUntil = 0, factor = 1 }) {
  const L = curve.getLength(), G = speed * PERIOD;
  // progress p (constant speed) → arc length s: ds/dp eases from factor to 1 around fastUntil
  const ps = [0], ss = [0], dp = 0.05, w = 6;
  while (ss.at(-1) < L) { const k = 1 + (factor - 1) * (1 - THREE.MathUtils.smoothstep(ss.at(-1), fastUntil - w, fastUntil + w)); ps.push(ps.at(-1) + dp); ss.push(ss.at(-1) + k * dp); }
  const PL = ps.at(-1), n = Math.ceil(PL / G) + 1;
  const sOf = (p) => { const i = Math.min(ss.length - 2, Math.floor(p / dp)); return ss[i] + (ss[i + 1] - ss[i]) * ((p - ps[i]) / dp); };
  const items = Array.from({ length: n }, (_, i) => { const v = make(); group.add(v); return { v, p0: (i - 1) * G + offset * G }; });
  const t = new THREE.Vector3();
  return (tau) => {
    for (const it of items) {
      const p = it.p0 + speed * tau;
      it.v.visible = p >= 0 && p < PL;
      if (!it.v.visible) continue;
      const u = Math.min(1, sOf(p) / L);
      curve.getPointAt(u, it.v.position); curve.getTangentAt(u, t);
      it.v.rotation.set(-Math.asin(Math.max(-1, Math.min(1, t.y))), Math.atan2(t.x, t.z), 0, 'YXZ');
    }
  };
}
const MIX = [['suv', '#F2F2EE'], ['sedan', '#A9AEB3'], ['hatch', '#2D4D78']]; // the three lines of a mixed car queue
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
  const tr = convoy(g, roadK, { center: sK, half: 50, speed: 3.2, lane: SLOW, make: (i) => V.carTransporter(i + 2) });
  const back = convoy(g, roadK, { center: sK, half: 50, speed: 3.6, dir: -1, lane: SLOW, make: () => V.carTransporter(1) });
  // the inbound fast lane carries the export convoy bound for the car carrier (incheon())
  const kBack = convoy(g, roadK, { center: sK, half: 50, speed: 4.8, dir: -1, lane: FAST, make: () => V.car('hatch', '#1B1D21', 'lo') });
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
    lanes(tau); tr(tau); back(tau); kBack(tau); inspectors(ph); buyers(ph);
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
  // south berth: the container ship, worked by the cranes; north berth: the car carrier, loading over its side ramp
  const ship = V.containerShip({ len: 34 });
  ship.position.set(st.quay - ship.userData.w / 2 - 0.4, 0, 16); ship.rotation.y = Math.PI; g.add(ship);
  const roro = V.carCarrier({ ramp: 1, quayY: y }); roro.position.set(st.quay - roro.userData.w / 2 - 0.4, 0, 54); g.add(roro);
  for (const [sz, bz] of [[2, -2], [8, 6], [24, 26], [30, 34], [40, 38], [46, 44], [62, 64], [68, 70]]) g.add(P.mooringLine(new THREE.Vector3(st.quay - 0.6, 1.1, sz), new THREE.Vector3(st.quay + 0.6, y + 0.2, bz), 0.4));
  const slots = [];
  for (const x0 of [227.2, 229.8, 232.4]) for (let j = 0; j < 40; j++) { if ((j * 3 + Math.round(x0)) % 9 < 1) continue; slots.push({ x: x0, y, z: 2 + j * 1.0, ry: 0, type: ['suv', 'sedan', 'ev', 'hatch', 'suv'][(j + Math.round(x0)) % 5], color: V.CAR_COLORS[(j * 7 + Math.round(x0)) % V.CAR_COLORS.length] }); }
  g.add(V.carLot(slots));
  const cranes = [6, 20].map((z) => { const c = K.stsCrane(); c.position.set(st.quay + 2.4, y, z); g.add(c); return c; });
  K.setBoom(cranes[0], -1.3); // idle, boom up
  // loading: trucks bring LINDJA containers from the stuffing shed at the south end, the crane lifts each into the hold
  const lane = st.quay + 2.4, back = lane + 2, shipX = ship.position.x - lane;
  const cfs = K.shed({ w: 4.6, d: 5, h: 1.7, color: K.C.white, roof: '#3D6FA6' }); g.add(place(cfs, lane + 1, -1.6, { y }));
  const ring = path3([[lane + 1, y, -2.6], [lane, y, -1.6], [lane, y, 6], [lane, y, 14], [lane, y, 20], [lane, y, 27], [lane + 0.3, y, 28.6], [lane + 1, y, 29.2], [back - 0.3, y, 28.6], [back, y, 27], [back, y, 16], [back, y, 6], [back, y, -1.6]], true);
  const trucks = truckRing(g, ring, { count: 11, stop: [lane, 20], mode: 'load', make: () => V.terminalTruck() });
  // export cars come down the highway, along the quay and up the ramp into the car decks
  roro.updateMatrixWorld(true);
  const foot = roro.localToWorld(roro.userData.foot.clone()), door = roro.localToWorld(roro.userData.door.clone());
  const Lk = roadK.getLength(), road = [];
  for (let s = 0; s <= Lk - 2; s += 4) { const p = onRoad(roadK, s, FAST); road.push([p.x, p.y, p.z]); }
  const aboard = path3([...road, [225.8, y + 0.07, 47.6], [227.3, y + 0.07, 50.2], [228.3, y + 0.07, 52.8], [227.4, y + 0.07, foot.z], [foot.x, foot.y + 0.05, foot.z], [door.x, door.y + 0.05, door.z], [door.x - 1.8, door.y + 0.05, door.z]]);
  const loading = MIX.map(([t, c], k) => chain3(g, aboard, { speed: 1, offset: k / 3, fastUntil: Lk - 6, factor: 3, make: () => V.car(t, c) }));
  const term = K.shed({ w: 10, d: 6, h: 2.2, color: K.C.white, roof: '#3D6FA6' }); g.add(place(term, 258, 10, { y }));
  for (let z = 2; z <= 62; z += 12) g.add(place(P.lightTower(5), 235.2, z, { y }));
  const tug = pathRing(g, path3([[211, 0.15, 6], [204, 0.15, 12], [208, 0.15, 20], [213.4, 0.15, 12]], true), { count: 1, make: () => P.tugboat(), bob: 0.05 });
  // dock crew: two at the ramp foot waving the cars aboard, two in the crane portal; a forklift at the terminal shed
  const crew = [[foot.x + 0.3, foot.z - 1.1, -1.2], [foot.x + 0.3, foot.z + 1.1, -2.0], [lane + 0.9, 18.6, 1.6], [lane - 0.9, 21.4, -1.4]].map(([x, z, ry], i) => { const w = P.dockWorker(i * 0.27); g.add(place(w, x, z, { y, ry })); return w; });
  const fork = P.forkliftTruck(); g.add(fork);
  const gulls = [0, 1].map(() => { const b = V.gull(); g.add(b); return b; });
  const anchors = [
    anchorAt(g, 'port-ship', 218.5, 5, 48),
    anchorAt(g, 'port-ramp', 224, 1.6, 54),
    anchorAt(g, 'port-quay', 228, 2, 22),
  ];
  const update = (tau) => {
    const ph = tau / PERIOD, a = TAU * ph;
    loading.forEach((c) => c(tau)); tug(tau); crew.forEach((w) => w.userData.work(tau));
    fork.position.set(256, y, 13.6 + 2.8 * wave(tau)); fork.rotation.y = Math.PI; // in and out of the shed door
    ship.position.y = 0.03 * Math.sin(a);
    V.spinRadar(ship, ph * 2);
    K.craneWork(cranes[1], tau, { mode: 'load', ship: shipX, truckY: 0.72 }); trucks(tau);
    gulls.forEach((b, i) => { b.position.set(214 + 6 * Math.cos(a + i * 3), 10 + i, 30 + 9 * Math.sin(a + i * 3)); b.rotation.y = -(a + i * 3); b.children.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * (0.25 + 0.35 * Math.sin(a * 6 + i)); }); });
  };
  return { id: 'port', group: g, anchors, update };
}

// ---------------------------------------------------------------- 2 · at sea
function sea() {
  const g = new THREE.Group(); g.name = 'deti';
  const ship = V.carCarrier({ ramp: 1, deployed: false });
  ship.rotation.y = -Math.PI / 2; // heading west (-x): Korea to Albania
  g.add(ship);
  ship.userData.underway = true; // the sea draws its bow wave and wake (terrain.js)
  const isle = V.lighthouseIslet(); isle.position.set(-34, 0.2, -24); g.add(isle);
  const lamp = isle.children.find((o) => o.material?.emissiveIntensity === 0.6);
  const far = V.containerShip({ len: 27 }); far.rotation.y = Math.PI / 2 - 0.15; far.position.set(80, 0, -66); far.userData.underway = true; g.add(far);
  const fisher = passer(g, [-70, 0.1, 34], [60, 0.1, 22], () => P.fishingBoat());
  const dolphins = [0, 1, 2].map(() => { const d = P.dolphin(); g.add(d); return d; });
  const gulls = [0, 1, 2].map(() => { const b = V.gull(); g.add(b); return b; });
  const anchors = [anchorAt(g, 'deti-ship', 2, 6, 0), anchorAt(g, 'deti-isle', -12, 2, 9)];
  const update = (tau) => {
    const ph = tau / PERIOD, a = TAU * ph;
    ship.position.y = 0.12 * Math.sin(a); ship.rotation.z = 0.012 * Math.sin(a + 0.6);
    V.spinRadar(ship, ph * 2); V.spinRadar(far, ph);
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
  // south berth: the car carrier, cars driven off down its ramp; north berth: the container ship and the cranes
  const ship = V.containerShip({ len: 34 }); ship.position.set(st.quay + ship.userData.w / 2 + 0.4, 0, 38); g.add(ship);
  const roro = V.carCarrier({ ramp: -1, quayY: y }); roro.position.set(st.quay + roro.userData.w / 2 + 0.4, 0, 0); g.add(roro);
  for (const [sz, bz] of [[24, 20], [30, 28], [46, 48], [52, 56], [-16, -18], [-10, -12], [10, 12], [16, 18]]) g.add(P.mooringLine(new THREE.Vector3(st.quay + 0.6, 1.1, sz), new THREE.Vector3(st.quay - 0.6, y + 0.2, bz), 0.4));
  // imported cars drive out of the car deck, down the ramp, through customs and into the inspection shed
  roro.updateMatrixWorld(true);
  const foot = roro.localToWorld(roro.userData.foot.clone()), door = roro.localToWorld(roro.userData.door.clone());
  const ashore = path3([[door.x + 1.8, door.y + 0.05, 0], [door.x, door.y + 0.05, 0], [foot.x, foot.y + 0.05, 0], [-228.2, y + 0.03, -1.4], [-231.5, y + 0.03, -4.2], [-234, y + 0.02, -5], [-240, y + 0.02, -5], [-245, y + 0.02, -2], [-249, y + 0.02, 4], [-253, y + 0.02, 6.4]]);
  const unloading = MIX.map(([t, c], k) => chain3(g, ashore, { speed: 1, offset: k / 3, make: () => V.car(t, c) }));
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
  const tr = convoy(g, roadA, { center: sA, half: 45, speed: 3.4, lane: SLOW, make: (i) => V.carTransporter(i + 7) });
  const traffic = convoy(g, roadA, { center: sA, half: 45, speed: 4.2, dir: -1, lane: SLOW, make: () => V.car('van', '#F2F2EE', 'lo') });
  const aCars = convoy(g, roadA, { center: sA, half: 45, speed: 5.6, lane: FAST, make: () => V.car('sedan', '#6C7177', 'lo') });
  const aBack = convoy(g, roadA, { center: sA, half: 45, speed: 5.0, dir: -1, lane: FAST, make: () => V.car('ev', '#A9AEB3', 'lo') });
  const cr = [30, 44].map((z) => { const c = K.stsCrane(); c.position.set(st.quay - 2.4, y, z); c.rotation.y = Math.PI; g.add(c); return c; });
  K.setBoom(cr[1], -1.3); // idle, boom up
  // unloading: empty trucks leave the shed at the north end, the crane sets a container on each, they drive it back in
  const lane = st.quay - 2.4, back = lane - 2, shipX = -(ship.position.x - lane);
  const cfs = K.shed({ w: 4.6, d: 5, h: 1.7, color: K.C.white, roof: K.C.orange }); g.add(place(cfs, lane - 1, 57.4, { y }));
  const ring = path3([[lane - 1, y, 58.4], [lane, y, 57.4], [lane, y, 50], [lane, y, 40], [lane, y, 30], [lane, y, 26], [lane - 0.3, y, 24.4], [lane - 1, y, 23.8], [back + 0.3, y, 24.4], [back, y, 26], [back, y, 36], [back, y, 48], [back, y, 57.4]], true);
  const trucks = truckRing(g, ring, { count: 12, stop: [lane, 30], mode: 'unload', make: () => V.terminalTruck() });
  for (let z = -10; z <= 58; z += 12) g.add(place(P.lightTower(5), -236.4, z, { y }));
  const tug = pathRing(g, path3([[-210, 0.15, 22], [-203, 0.15, 28], [-207, 0.15, 36], [-212.4, 0.15, 28]], true), { count: 1, make: () => P.tugboat('#2F6E8C'), bob: 0.05 });
  const officers = P.walkers(g, [[-237.2, -2.6], [-237.2, -7.4], [-236.6, -7.4], [-236.6, -2.6]], 2, '#2D4D78', y);
  // dock crew at the ramp foot and in the crane portal; a forklift at the inspection shed
  const crew = [[foot.x - 0.3, -1.1, 1.2], [foot.x - 0.3, 1.1, 2.0], [lane - 0.9, 28.6, -1.6], [lane + 0.9, 31.4, 1.4]].map(([x, z, ry], i) => { const w = P.dockWorker(0.5 + i * 0.23); g.add(place(w, x, z, { y, ry })); return w; });
  const fork = P.forkliftTruck(); g.add(fork);
  const flags = brandFlags(g, [-244.6, -243.6], 11, y);
  const anchors = [
    anchorAt(g, 'durres-ship', -224, 1.8, 0),
    anchorAt(g, 'durres-customs', -240, 4, -5),
    anchorAt(g, 'durres-kolaudim', -232, 2, 20),
  ];
  const update = (tau) => {
    const ph = tau / PERIOD, a = TAU * ph;
    unloading.forEach((c) => c(tau)); tr(tau); traffic(tau); aCars(tau); aBack(tau); tug(tau); officers(ph); crew.forEach((w) => w.userData.work(tau));
    fork.position.set(-250, y, 9.1 + 2.8 * wave(tau, 1, 1.3)); fork.rotation.y = Math.PI;
    ship.position.y = 0.03 * Math.sin(a);
    V.spinRadar(ship, ph * 2);
    K.craneWork(cr[0], tau, { mode: 'unload', ship: shipX, truckY: 0.72 }); trucks(tau);
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
  // the route in: highway traffic past Tirana, and loaded car transporters leaving it by a slip road that runs along
  // the front of the lot and round its west side to the unloading bay behind the showroom
  const sT = nearestS(roadA, -330, -2);
  const hw = [
    convoy(g, roadA, { center: sT, half: 50, speed: 3.4, lane: SLOW, make: (i) => V.carTransporter(i + 30) }),
    convoy(g, roadA, { center: sT, half: 50, speed: 5.4, lane: FAST, make: () => V.car('sedan', '#F2F2EE', 'lo') }),
    convoy(g, roadA, { center: sT, half: 50, speed: 4.2, dir: -1, lane: SLOW, make: () => V.car('van', '#6C7177', 'lo') }),
    convoy(g, roadA, { center: sT, half: 50, speed: 5.0, dir: -1, lane: FAST, make: () => V.car('ev', '#1B1D21', 'lo') }),
  ];
  const sX = nearestS(roadA, -308, 12);
  const ramp = [];
  for (let s = sX - 36; s <= sX; s += 3) { const p = onRoad(roadA, s, SLOW); ramp.push(new THREE.Vector3(p.x, 0, p.z)); }
  const slip = [[-306.6, 4], [-308.7, -5], [-311.5, -12], [-322, -14.5], [-340, -14.5], [-356, -14.5], [-361.5, -19], [-362.5, -30], [-362, -44], [-358, -49], [-350, -50.5], [-343, -50.5]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const route = new THREE.CatmullRomCurve3([...ramp, ...slip], false, 'centripetal', 0.5);
  g.add(slipRoad(new THREE.CatmullRomCurve3([ramp.at(-1), ...slip], false, 'centripetal', 0.5), 1.5));
  const deliveries = chainOnce(g, route, { speed: 3.2, make: () => V.carTransporter(41) });
  g.add(V.tiranaBlocks(41));
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
    testers(tau); customers(ph); staff(ph); hw.forEach((c) => c(tau)); deliveries(tau);
    flags.forEach((f, i) => P.wave(f, ph + i * 0.17));
    const k = wave(tau, 1);
    svcCar.position.set(-316, y, -49.4 + 3.2 * k); svcCar.rotation.y = 0;
  };
  return { id: 'salloni', group: g, anchors, update };
}

export function buildStations() { return [yard(), incheon(), sea(), durres(), tirana()]; }
