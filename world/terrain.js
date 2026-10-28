// The relief board: hypsometric layers with engraved contour lines, the Adriatic as glossy resin, and the roads.
import * as THREE from 'three';
import { MAP, STATIONS, ROAD_K, ROAD_A, height, rectDist } from './geo.js';
import { simplex2, smoothstep } from './noise.js';

const fieldNoise = simplex2(101);
const tone = (hex) => new THREE.Color(hex);
const T = {
  deep: tone('#2B6880'), shallow: tone('#6FB2AC'), beach: tone('#E9DDBF'), dry: tone('#E1CF9F'), field: tone('#B9C27F'),
  field2: tone('#D6B987'), field3: tone('#A9B46E'), hill: tone('#97A266'), forest: tone('#6E7F4C'), high: tone('#8C8B76'), rock: tone('#A79F92'), snow: tone('#F4F4F0'),
  pad: tone('#D9D6CF'), grass: tone('#C7C58F'), asphalt: tone('#6B6E72'),
  paddy: tone('#A8BE6E'), paddy2: tone('#BFCB86'), kForest: tone('#5C7A49'), granite: tone('#B5AFA5'),
};

export function buildTerrain() {
  const nx = Math.round(MAP.w / MAP.cell), nz = Math.round(MAP.d / MAP.cell);
  const geo = new THREE.PlaneGeometry(MAP.w, MAP.d, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    if (y < -0.05) c.copy(T.shallow).lerp(T.deep, smoothstep(0, 5, -y));
    else if (y < 0.9) c.copy(T.beach);
    else if (y < 6) {
      // Albania: parcels of wheat, stubble and green; Korea: rice paddies
      const f = fieldNoise(Math.floor(x / 6.5) * 1.7, Math.floor(z / 4.5) * 1.3);
      if (x > 0) c.copy(f > 0.1 ? T.paddy : f < -0.4 ? T.dry : T.paddy2).lerp(T.hill, smoothstep(4, 6, y));
      else c.copy(f > 0.3 ? T.field : f < -0.35 ? T.field2 : f > 0 ? T.field3 : T.dry).lerp(T.hill, smoothstep(4, 6, y));
    } else if (y < 16) c.copy(T.hill).lerp(x > 0 ? T.kForest : T.forest, smoothstep(7, 16, y));
    else if (y < 34) c.copy(x > 0 ? T.kForest : T.forest).lerp(x > 0 ? T.granite : T.high, smoothstep(20, 34, y));
    else c.copy(x > 0 ? T.granite : T.rock).lerp(T.snow, smoothstep(44, 52, y));
    if (y > 2 && slope > 0.32) c.lerp(T.rock, smoothstep(0.32, 0.62, slope) * 0.85);
    for (const st of STATIONS) {
      if (st.pad == null || (st.quay != null && (x - st.quay) * st.seaSide > 0)) continue;
      const d = rectDist(st, x, z);
      const g = st.ground === 'grass' ? T.grass : st.ground === 'asphalt' ? T.asphalt : T.pad;
      if (d <= 0.5) c.copy(g);
      else if (d < 3) c.lerp(g, 1 - d / 3);
    }
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float ch = vWY / 1.25;
          float fw = max(fwidth(ch), 1e-4);
          float f = abs(fract(ch - 0.5) - 0.5) / fw;
          float major = abs(fract(ch / 5.0 - 0.5) - 0.5) / (fw / 5.0);
          float line = (1.0 - min(f / 0.9, 1.0)) * 0.05 + (1.0 - min(major / 1.1, 1.0)) * 0.08;
          float land = smoothstep(1.0, 2.5, vWY);
          diffuseColor.rgb *= 1.0 - line * land;
        }`);
  };
  const mesh = new THREE.Mesh(geo, m);
  mesh.receiveShadow = true; mesh.castShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

export function buildSea() {
  const w = 560, d = MAP.d;
  const geo = new THREE.PlaneGeometry(w, d, Math.round(w / 2.4), Math.round(d / 2.4));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const shore = new Float32Array(pos.count);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const depth = -height(x, z);
    c.copy(T.shallow).lerp(T.deep, smoothstep(0.2, 7, depth)).lerp(new THREE.Color('#1F5670'), smoothstep(8, 20, depth));
    if (depth < 0.6) c.lerp(new THREE.Color('#BFE0D8'), 0.45);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    shore[i] = 1 - smoothstep(0, 2.6, depth); // 1 at the waterline, 0 offshore
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aShore', new THREE.BufferAttribute(shore, 1));
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.0, flatShading: false, envMapIntensity: 0.75 });
  const uniforms = { uPhase: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPhase = uniforms.uPhase;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPhase;\nattribute float aShore;\nvarying float vShore;')
      .replace('#include <beginnormal_vertex>', `
        float a0 = uPhase * 6.2831853, o0 = 1.0 - aShore * 0.7;
        float dx = o0 * (0.11 * 0.9 * cos(position.x * 0.9 + position.z * 0.35 + a0) - 0.07 * 0.4 * cos(position.z * 1.3 - position.x * 0.4 - a0) + 0.04 * 2.3 * cos(position.x * 2.3 + position.z * 1.9 + 2.0 * a0));
        float dz = o0 * (0.11 * 0.35 * cos(position.x * 0.9 + position.z * 0.35 + a0) + 0.07 * 1.3 * cos(position.z * 1.3 - position.x * 0.4 - a0) + 0.04 * 1.9 * cos(position.x * 2.3 + position.z * 1.9 + 2.0 * a0));
        vec3 objectNormal = normalize(vec3(-dx, 1.0, -dz));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(1.0, 0.0, 0.0);
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float a = uPhase * 6.2831853;
        vShore = aShore;
        float off = 1.0 - aShore * 0.7; // calmer in the shallows
        transformed.y += off * (0.11 * sin(position.x * 0.9 + position.z * 0.35 + a) + 0.07 * sin(position.z * 1.3 - position.x * 0.4 - a) + 0.04 * sin(position.x * 2.3 + position.z * 1.9 + 2.0 * a));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uPhase;\nvarying float vShore;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // surf: a solid line at the waterline plus bands that roll in with the loop
          float t = uPhase * 6.2831853;
          float bands = 0.5 + 0.5 * sin(vShore * 22.0 - t * 2.0);
          float foam = smoothstep(0.86, 0.98, vShore) * 0.9 + smoothstep(0.35, 0.92, vShore) * smoothstep(0.8, 0.97, bands) * 0.55;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 0.96), clamp(foam, 0.0, 1.0));
        }`);
  };
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.y = 0.02;
  mesh.receiveShadow = true;
  mesh.name = 'sea';
  mesh.userData.uniforms = uniforms;
  return mesh;
}

// Smooth curves along the road polylines, with a ribbon mesh laid on the terrain.
export function roadCurve(pts) {
  return new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal', 0.5);
}
export function buildRoad(curve, { width = 1.9, color = '#3B3E43', dashes = true, material = null } = {}) {
  const L = curve.getLength();
  const n = Math.ceil(L / 0.7);
  const pts = curve.getSpacedPoints(n);
  const verts = [], idx = [], uvs = [];
  const dashVerts = [], dashIdx = [];
  const side = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const p = pts[i];
    const q = pts[Math.min(n, i + 1)], o = pts[Math.max(0, i - 1)];
    side.set(-(q.z - o.z), 0, q.x - o.x).normalize();
    const y = height(p.x, p.z) + 0.07;
    verts.push(p.x + side.x * width / 2, y, p.z + side.z * width / 2, p.x - side.x * width / 2, y, p.z - side.z * width / 2);
    uvs.push(0, i * 0.35, 1, i * 0.35);
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    if (dashes && i % 4 < 2 && i < n) {
      const b = dashVerts.length / 3;
      const p2 = pts[i + 1], y2 = height(p2.x, p2.z) + 0.08, dw = 0.05;
      dashVerts.push(p.x + side.x * dw, y + 0.01, p.z + side.z * dw, p.x - side.x * dw, y + 0.01, p.z - side.z * dw, p2.x + side.x * dw, y2 + 0.01, p2.z + side.z * dw, p2.x - side.x * dw, y2 + 0.01, p2.z - side.z * dw);
      dashIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
  const group = new THREE.Group();
  const road = new THREE.Mesh(g, material || new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide }));
  road.receiveShadow = true; group.add(road);
  if (dashes) {
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dashVerts, 3)); dg.setIndex(dashIdx); dg.computeVertexNormals();
    const dm = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ color: '#EDEBE4', roughness: 0.9, side: THREE.DoubleSide }));
    dm.receiveShadow = true; group.add(dm);
  }
  return group;
}

export const roadK = roadCurve(ROAD_K);
export const roadA = roadCurve(ROAD_A);

// Position and heading of a vehicle at arc length s on a road, in a lane (+ right, - left).
const _p = new THREE.Vector3(), _t = new THREE.Vector3();
export function onRoad(curve, s, lane = 0.45) {
  const L = curve.getLength();
  const u = ((s % L) + L) % L / L;
  curve.getPointAt(u, _p); curve.getTangentAt(u, _t);
  const x = _p.x + -_t.z * lane, z = _p.z + _t.x * lane;
  return { x, y: height(x, z) + 0.07, z, heading: Math.atan2(_t.x, _t.z) };
}

