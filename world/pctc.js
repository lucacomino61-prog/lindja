// Pure car and truck carrier (PCTC), built from the real type at 0.2 units per metre: 180 m long, 31 m beam, the hull
// standing 32 m out of the water. The hull is lofted through fourteen sections (bluff round bow that fines toward the
// keel, rounded bilge, stern cut away under water); its shell carries plating seams, vent louvres in relief, rust and
// grime, draft marks and the name; on top: bridge house across the bow with wings and windows, mast with radars,
// funnel with exhausts, fan houses along the deck edges, railings, free-fall lifeboat, rescue boat on its davit, the
// closed stern ramp; amidships a side ramp (ramp: +1 starboard / -1 port) lowered to the quay, or shut at sea.
// Bow +z, waterline y = 0. userData.door / userData.foot: the ramp's top and foot in ship coordinates.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, C, shadowed } from './kit.js';

const S = { L: 36, B: 6.2, D: 1.7, A: 6.4, sill: 1.8, rampL: 4.6, rampW: 1.4, name: 'LINDJA STAR' };
const NSIDE = 40, NBOW = 36, NSTERN = 12; // points per stretch of every section (same for all, so sections join)

// half-breadth at height y: the bow gets finer and longer toward the keel, the stern lifts away under water
function section(y) {
  const { L, B, D } = S, hb = B / 2;
  const k = THREE.MathUtils.clamp((y + D) / D, 0, 1); // 0 at the keel, 1 at the waterline and above
  const bowLen = THREE.MathUtils.lerp(9.5, 6.2, k), full = THREE.MathUtils.lerp(1.25, 2.4, k);
  const sternZ = -L / 2 + (1 - k) * 3.2, bilge = THREE.MathUtils.lerp(0.82, 1, Math.pow(k, 0.5));
  const w = hb * bilge, zb = L / 2 - bowLen;
  const pts = [];
  for (let i = 0; i < NSIDE; i++) pts.push([w, THREE.MathUtils.lerp(sternZ + 0.6, zb, i / NSIDE)]); // starboard, aft to fore
  for (let i = 0; i < NBOW; i++) { const t = (i / NBOW) * Math.PI; pts.push([w * Math.sign(Math.cos(t)) * Math.pow(Math.abs(Math.cos(t)), 2 / full), zb + bowLen * Math.pow(Math.sin(t), 1 / 1.15)]); }
  for (let i = 0; i < NSIDE; i++) pts.push([-w, THREE.MathUtils.lerp(zb, sternZ + 0.6, i / NSIDE)]); // port, fore to aft
  for (let i = 0; i < NSTERN; i++) { const t = i / NSTERN, r = 0.6; // transom with rounded quarters
    const x = THREE.MathUtils.lerp(-w, w, t), corner = Math.min(1, Math.min(Math.abs(x + w), Math.abs(w - x)) / r);
    pts.push([x, sternZ + 0.6 - 0.6 * Math.sqrt(Math.max(0, 1 - (1 - corner) ** 2))]); }
  return pts;
}
const LEVELS = [-1.7, -1.55, -1.35, -1.1, -0.8, -0.45, -0.15, 0, 0.6, 1.5, 2.5, 3.8, 5.2, 6.4];

// ---------- the shell texture: u runs round the hull (starboard aft→fore, bow, port fore→aft, stern), v up ----------
function shellTexture(perim, mark, open) {
  // u runs backwards round the hull, so that seen from outside the lettering reads the right way on every face
  const { D, A, sill, rampW } = S, H = D + A;
  const W = 8192, Hp = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = Hp;
  const g = cv.getContext('2d');
  const Y = (y) => Hp * (1 - (y + D) / H), U = (s) => (1 - s / perim) * W;
  const R = (s0, s1, y0, y1) => { const xa = U(s0), xb = U(s1); g.fillRect(Math.min(xa, xb), Y(Math.max(y0, y1)), Math.abs(xb - xa), Math.abs(Y(y0) - Y(y1))); };
  const band = (y0, y1, fill) => { g.fillStyle = fill; g.fillRect(0, Y(y1), W, Y(y0) - Y(y1)); };
  band(-D, A, '#7B2C24');
  band(0.12, 2.2, '#1B2A40');
  band(-0.1, 0.12, '#101216');
  band(0.12, 0.32, 'rgba(70, 82, 60, 0.35)'); // waterline grime
  const white = g.createLinearGradient(0, Y(A), 0, Y(2.2)); white.addColorStop(0, '#EEEFEB'); white.addColorStop(1, '#E2E3DE');
  band(2.2, A, white);
  band(2.2, 2.32, '#FF4F12'); // sheer stripe
  for (let y = 2.8; y < A - 0.15; y += 0.55) { band(y - 0.01, y, 'rgba(120,126,128,0.55)'); band(y - 0.017, y - 0.01, 'rgba(255,255,255,0.6)'); } // deck seams
  g.fillStyle = 'rgba(130,136,138,0.28)'; for (let s = 0; s < perim; s += 0.9) R(s, s + 0.012, 0.15, A); // frame seams
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 520; i++) { // rust and grime streaks
    const s = rnd() * perim, y0 = 0.3 + rnd() * (A - 0.4), len = 0.2 + rnd() * 1.4;
    g.fillStyle = rnd() < 0.6 ? `rgba(110, 70, 42, ${0.05 + rnd() * 0.12})` : `rgba(60, 60, 58, ${0.04 + rnd() * 0.08})`;
    R(s, s + 0.012 + rnd() * 0.02, y0 - len, y0);
  }
  g.fillStyle = '#1D2833'; // accommodation windows round the bow, three decks under the bridge
  for (const y of [4.75, 5.3, 5.85]) for (let s = mark.bowFrom; s < mark.bowTo; s += 0.42) R(s, s + 0.24, y, y + 0.17);
  g.fillStyle = '#F4F4F0'; g.textBaseline = 'middle';
  const text = (str, s, y, h, align) => { g.font = `700 ${Math.round((Hp * h) / H)}px "Big Shoulders Display", Arial, sans-serif`; g.textAlign = align; g.fillText(str, U(s), Y(y)); };
  text(S.name, mark.stbdBow - 0.8, 1.55, 0.62, 'left'); // starts just aft of the bow
  text(S.name, mark.portBow + 0.8, 1.55, 0.62, 'right');
  text(S.name, mark.stern + S.B / 2, 1.6, 0.42, 'center');
  for (const s of [mark.stbdBow - 1.2, mark.portBow + 1.2, mark.stbdMid + 3, mark.portMid - 3, 1.2, mark.stern - 1.2]) for (let d = 0; d < 8; d++) text(String(2 * d + 2), s, -1.45 + d * 0.21, 0.13, 'center'); // draft marks
  const door = (s, y0, w, h, fill) => { if (fill) { g.fillStyle = '#07080A'; R(s - w / 2, s + w / 2, y0, y0 + h); } g.strokeStyle = '#A3A8AA'; g.lineWidth = 4; const xa = U(s - w / 2), xb = U(s + w / 2); g.strokeRect(Math.min(xa, xb), Y(y0 + h), Math.abs(xb - xa), Y(y0) - Y(y0 + h)); };
  door(mark.stbdMid, sill, rampW, 1.05, open > 0); door(mark.portMid, sill, rampW, 1.05, open < 0);
  door(mark.stbdMid - 4, 0.6, 0.3, 0.45, true); door(mark.portMid + 4, 0.6, 0.3, 0.45, true); // pilot doors
  door(mark.stern + S.B / 2 + (open >= 0 ? 0.8 : -0.8), 0.9, 3.6, 2.5, false); // stern ramp, shut
  g.fillStyle = '#0C0D10'; // anchor pockets
  for (const s of [mark.stbdBow - 2.0, mark.portBow + 2.0]) { g.beginPath(); g.ellipse(U(s), Y(1.15), (0.32 / perim) * W, (Hp * 0.22) / H, 0, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}
function slatTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32;
  const g = cv.getContext('2d'); g.fillStyle = '#23272C'; g.fillRect(0, 0, 64, 32);
  for (let y = 2; y < 32; y += 6) { g.fillStyle = '#5A6068'; g.fillRect(0, y, 64, 2); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function windowBand(w, h, rows) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = '#EDEEEA'; g.fillRect(0, 0, 512, 128);
  for (let r = 0; r < rows; r++) for (let x = 6; x < 512; x += 22) { g.fillStyle = r === rows - 1 ? '#18232D' : '#26313B'; g.fillRect(x, 10 + r * (110 / rows), r === rows - 1 ? 20 : 12, (110 / rows) * 0.55); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(Math.max(1, w / 3), 1); return t;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const at = (geo, x, y, z, ry = 0) => { if (ry) geo.rotateY(ry); return geo.translate(x, y, z); };
function m(geo, material, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; }
function instanced(geo, material, list) {
  const im = new THREE.InstancedMesh(geo, material, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  list.forEach(([x, y, z, ry = 0], i) => im.setMatrixAt(i, m4.compose(p.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), one)));
  im.castShadow = true; im.receiveShadow = true; return im;
}

export function carCarrier({ ramp = 1, quayY = 0.6, deployed = true } = {}) {
  const { L, B, D, A, sill, rampL, rampW } = S, hb = B / 2;
  const g = new THREE.Group();
  // ---- the lofted shell
  const rings = LEVELS.map((y) => section(y));
  const deckRing = rings.at(-1);
  const lens = deckRing.map((p, i) => Math.hypot(...deckRing[(i + 1) % deckRing.length].map((c, k) => c - p[k])));
  const perim = lens.reduce((a, b) => a + b, 0);
  const cum = [0]; for (let i = 0; i < lens.length; i++) cum.push(cum[i] + lens[i]);
  // distances round the deck line: midships (z = 0) on each side, where the bow starts and ends, the stern
  const mark = { stbdMid: -deckRing[0][1], portMid: cum[NSIDE + NBOW] + deckRing[NSIDE + NBOW][1], stbdBow: cum[NSIDE], portBow: cum[NSIDE + NBOW], bowFrom: cum[NSIDE] - 4.5, bowTo: cum[NSIDE + NBOW] + 4.5, stern: cum[2 * NSIDE + NBOW] };
  const verts = [], uvs = [], idx = [], n = deckRing.length;
  rings.forEach((ring, k) => { for (let i = 0; i <= n; i++) { const [x, z] = ring[i % n]; verts.push(x, LEVELS[k], z); uvs.push(1 - cum[i] / perim, (LEVELS[k] + D) / (D + A)); } }); // u backwards, as the texture
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) { const a = k * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d); } // faces outward
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); shellGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); shellGeo.setIndex(idx);
  shellGeo.computeVertexNormals();
  g.add(m(shellGeo, new THREE.MeshStandardMaterial({ map: shellTexture(perim, mark, deployed ? ramp : 0), roughness: 0.5, metalness: 0.08 })));
  // weather deck, its lip and the railing round it
  const deck = new THREE.Shape(deckRing.map(([x, z]) => new THREE.Vector2(x, -z)));
  const top = new THREE.ShapeGeometry(deck); top.rotateX(-Math.PI / 2);
  g.add(m(top, mat('#8E9690', { roughness: 0.75 }), 0, A, 0));
  const white = mat('#ECEDE9', { roughness: 0.45, metalness: 0.08 }), steel = mat('#3A3F45', { roughness: 0.45, metalness: 0.6 }), dark = mat('#14191F', { roughness: 0.2, metalness: 0.3 });
  const lip = [], posts = [];
  for (let i = 0; i < n; i++) {
    const [x0, z0] = deckRing[i], [x1, z1] = deckRing[(i + 1) % n], len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    lip.push(at(box(0.07, 0.1, len + 0.02), (x0 + x1) / 2, A - 0.05, (z0 + z1) / 2, ry));
    lip.push(at(box(0.025, 0.025, len + 0.02), (x0 + x1) / 2 * 0.985, A + 0.24, (z0 + z1) / 2 * 0.995, ry)); // top rail
    if (i % 2 === 0) posts.push([x0 * 0.985, A + 0.12, z0 * 0.995]);
  }
  g.add(m(mergeGeometries(lip), white));
  g.add(instanced(box(0.02, 0.24, 0.02), steel, posts));
  // vent louvres in relief, two rows along each side; fan houses on deck along both edges
  const slat = slatTexture(), louvre = new THREE.MeshStandardMaterial({ map: slat, roughness: 0.6, metalness: 0.3 });
  const vents = [], fans = [];
  for (let z = -L / 2 + 3.4; z < L / 2 - 8; z += 2.6) for (const s of [-1, 1]) {
    for (const y of [3.65, 5.3]) vents.push([s * (hb + 0.02), y, z, s > 0 ? Math.PI / 2 : -Math.PI / 2]);
    if (Math.abs(z) > 2.5 || ramp * s < 0) fans.push([s * (hb - 0.45), A + 0.2, z + 1.3]);
  }
  const ventGeo = new THREE.BoxGeometry(1.3, 0.34, 0.05);
  g.add(instanced(ventGeo, louvre, vents));
  g.add(instanced(box(0.5, 0.4, 0.75), white, fans));
  g.add(instanced(box(0.02, 0.22, 0.5), louvre, fans.map(([x, y, z]) => [x + Math.sign(x) * 0.26, y, z])));
  // bridge house across the bow: a front that follows the bow, window band, wings with cabs, lights
  const zf = L / 2 - 6.2;
  const plan = new THREE.Shape(); plan.moveTo(-hb + 0.1, -(zf - 3.0));
  plan.lineTo(hb - 0.1, -(zf - 3.0)); plan.lineTo(hb - 0.1, -zf);
  for (let i = 1; i <= 24; i++) { const t = (i / 24) * Math.PI; plan.lineTo((hb - 0.1) * Math.cos(t), -(zf + 2.2 * Math.sin(t))); }
  plan.closePath();
  const bh = new THREE.ExtrudeGeometry(plan, { depth: 1.1, bevelEnabled: false }); bh.rotateX(-Math.PI / 2);
  g.add(m(bh, white, 0, A, 0));
  const band = new THREE.Mesh(new THREE.ExtrudeGeometry(plan, { depth: 0.36, bevelEnabled: false }).rotateX(-Math.PI / 2).scale(1.006, 1, 1.004), new THREE.MeshStandardMaterial({ color: '#16212B', roughness: 0.08, metalness: 0.5 }));
  band.position.y = A + 0.62; g.add(band);
  g.add(m(box(B - 0.4, 0.06, 3.2), mat('#C9CBC6'), 0, A + 1.13, zf - 1.3)); // bridge roof
  for (const s of [-1, 1]) {
    g.add(m(box(0.9, 0.07, 1.1), white, s * (hb + 0.35), A + 0.96, zf + 0.5));
    g.add(m(box(0.42, 0.42, 0.5), white, s * (hb + 0.6), A + 1.2, zf + 0.5));
    g.add(m(box(0.43, 0.14, 0.51), dark, s * (hb + 0.6), A + 1.28, zf + 0.5));
    g.add(m(new THREE.SphereGeometry(0.06, 8, 6), mat(s > 0 ? '#2BD45B' : '#E2352B', { emissive: s > 0 ? '#2BD45B' : '#E2352B', emissiveIntensity: 1.2 }), s * (hb + 0.82), A + 1.05, zf + 0.75));
  }
  // mast: tapered pole, yard, two radar scanners, antennas
  const mast = new THREE.Group(); mast.position.set(0, A + 1.16, zf - 1.6); g.add(mast);
  mast.add(m(new THREE.CylinderGeometry(0.05, 0.09, 2.4, 8), steel, 0, 1.2, 0));
  mast.add(m(box(1.4, 0.05, 0.06), steel, 0, 1.9, 0));
  for (const [x, y, w] of [[-0.45, 1.45, 0.9], [0.4, 2.1, 1.1]]) { mast.add(m(box(0.3, 0.05, 0.3), steel, x, y - 0.06, 0)); mast.add(m(box(w, 0.06, 0.1), mat('#D8DAD6'), x, y, 0)); }
  for (const [x, h] of [[-0.6, 0.7], [0.62, 0.55], [0.15, 0.9]]) mast.add(m(new THREE.CylinderGeometry(0.012, 0.012, h, 5), steel, x, 1.95 + h / 2, 0));
  mast.add(m(new THREE.SphereGeometry(0.05, 8, 6), mat('#FFFFFF', { emissive: '#FFF7DD', emissiveIntensity: 1.5 }), 0, 2.45, 0));
  // funnel aft: casing with the brand band, black top, three exhausts
  const fz = -L / 2 + 3.4;
  g.add(m(box(1.5, 1.9, 1.9), white, 0, A + 0.95, fz));
  g.add(m(box(1.52, 0.3, 1.92), mat(C.orange), 0, A + 1.4, fz));
  g.add(m(box(1.52, 0.22, 1.92), mat('#121314'), 0, A + 1.95, fz));
  for (const x of [-0.42, 0, 0.42]) g.add(m(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 12), mat('#1A1B1D', { metalness: 0.5 }), x, A + 2.2, fz + 0.3));
  // free-fall lifeboat on its slipway over the stern; rescue boat on a davit at the side
  const slip = new THREE.Group(); slip.position.set(0, A - 0.15, -L / 2 + 0.2); slip.rotation.x = -0.55; g.add(slip);
  for (const x of [-0.32, 0.32]) slip.add(m(box(0.06, 0.08, 2.0), steel, x, 0, 0));
  const boat = m(new THREE.CapsuleGeometry(0.27, 1.1, 6, 14), mat('#F27A12', { roughness: 0.45 }), 0, 0.28, -0.1); boat.rotation.x = Math.PI / 2; slip.add(boat);
  slip.add(m(box(0.42, 0.24, 0.8), mat('#F27A12', { roughness: 0.45 }), 0, 0.5, 0.2));
  const dav = new THREE.Group(); dav.position.set(-ramp * (hb - 0.3), A, -L / 2 + 6.2); g.add(dav);
  dav.add(m(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 8), mat('#E3B526'), 0, 0.45, 0));
  dav.add(m(box(0.05, 0.05, 0.9), mat('#E3B526'), -ramp * 0.35, 0.88, 0).rotateY(Math.PI / 2));
  dav.add(m(new THREE.CapsuleGeometry(0.16, 0.6, 4, 10).rotateX(Math.PI / 2), mat('#F27A12'), -ramp * 0.65, 0.55, 0));
  // stern ramp, shut: a heavy panel on the stern quarter with hinge blocks and warning stripes
  const sr = new THREE.Group(); sr.position.set(ramp * 0.8, 0.9, -L / 2 - 0.02); g.add(sr);
  sr.add(m(box(3.4, 2.6, 0.12), mat('#D9DAD5', { roughness: 0.5 }), 0, 1.3, 0));
  for (let i = 0; i < 6; i++) sr.add(m(box(0.4, 0.08, 0.13), mat(i % 2 ? '#141516' : '#E3B526'), -1.5 + i * 0.6, 0.05, 0));
  for (const x of [-1.2, 0, 1.2]) sr.add(m(box(0.3, 0.2, 0.2), steel, x, 0.1, -0.05));
  // anchors in their pockets at the bow
  for (const s of [-1, 1]) {
    const a = new THREE.Group();
    a.add(m(box(0.08, 0.5, 0.08), mat('#141516', { metalness: 0.5 }), 0, 0, 0));
    a.add(m(box(0.36, 0.08, 0.1), mat('#141516', { metalness: 0.5 }), 0, -0.24, 0));
    const p = deckRing[NSIDE + Math.round((s > 0 ? 0.11 : 0.89) * NBOW)];
    a.position.set(p[0] * 1.01, 1.0, p[1] - 0.25); a.rotation.y = s * 0.5; g.add(a);
  }
  // side ramp amidships: tread plate, kerbs, end flap and the wires that hold it, at the door's frame
  const pivot = new THREE.Group(); pivot.position.set(ramp * hb, sill, 0);
  const frame = [box(0.08, 1.15, 0.08).translate(0, 0.55, -rampW / 2 - 0.04), box(0.08, 1.15, 0.08).translate(0, 0.55, rampW / 2 + 0.04), box(0.08, 0.08, rampW + 0.16).translate(0, 1.1, 0)];
  g.add(m(mergeGeometries(frame), mat('#9CA1A3', { metalness: 0.5 }), ramp * (hb + 0.03), sill, 0));
  if (deployed) {
    g.add(pivot);
    const tread = (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#4A4F55'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#5E646B'; for (let y = 4; y < 128; y += 16) for (let x = (y / 16) % 2 ? 0 : 8; x < 128; x += 16) c.fillRect(x, y, 10, 3); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 2); return t; })();
    pivot.add(m(box(rampL, 0.08, rampW), new THREE.MeshStandardMaterial({ map: tread, roughness: 0.6, metalness: 0.5 }), ramp * rampL / 2, 0, 0));
    for (const s of [-1, 1]) pivot.add(m(box(rampL, 0.14, 0.06), mat('#E3B526'), ramp * rampL / 2, 0.1, s * (rampW / 2 - 0.03)));
    pivot.add(m(box(0.5, 0.05, rampW), steel, ramp * (rampL + 0.22), -0.03, 0)); // end flap
    const drop = Math.asin(Math.min(0.95, (sill - quayY) / rampL));
    pivot.rotation.z = -ramp * drop;
    // wires from the hull above the door to the ramp's outer end
    const end = new THREE.Vector3(ramp * (hb + rampL * Math.cos(drop) * 0.75), sill - rampL * Math.sin(drop) * 0.75 + 0.1, 0);
    const wires = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(ramp * hb, sill + 2.2, s * 0.55), b = end.clone().setZ(s * 0.6), d = b.clone().sub(a);
      const w = m(new THREE.CylinderGeometry(0.012, 0.012, d.length(), 5), steel); w.position.copy(a).addScaledVector(d, 0.5); w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(w);
      wires.push(w);
    }
    g.userData.foot = new THREE.Vector3(ramp * (hb + rampL * Math.cos(drop)), quayY, 0);
    // the live page folds the ramp up against the hull to sail (setRamp(0)) and lowers it at the next quay (setRamp(1))
    g.userData.setRamp = (open) => { pivot.rotation.z = ramp * (-drop + (1 - open) * (Math.PI / 2 + drop)); pivot.visible = open > 0.02; wires.forEach((w) => { w.visible = open > 0.999; }); };
  }
  Object.assign(g.userData, { isShip: true, len: L, w: B, h: A, door: new THREE.Vector3(ramp * hb, sill, 0) });
  return shadowed(g);
}
