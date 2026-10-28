// The land: height-coloured relief with farm parcels and aerial-photo detail, the Adriatic lit as water, and the roads.
import * as THREE from 'three';
import { MAP, STATIONS, ROAD_K, ROAD_A, height, rectDist } from './geo.js';
import { simplex2, smoothstep } from './noise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
  const col = new Float32Array(pos.count * 3), field = new Float32Array(pos.count);
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
    let padF = 1;
    for (const st of STATIONS) {
      if (st.pad == null || (st.quay != null && (x - st.quay) * st.seaSide > 0)) continue;
      const d = rectDist(st, x, z);
      padF = Math.min(padF, smoothstep(1, 5, d));
      const g = st.ground === 'grass' ? T.grass : st.ground === 'asphalt' ? T.asphalt : T.pad;
      if (d <= 0.5) c.copy(g);
      else if (d < 3) c.lerp(g, 1 - d / 3);
    }
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    // farmland the fragment shader draws as parcels: the coastal plains, not beaches, slopes, hills or the yards
    field[i] = smoothstep(1.0, 1.7, y) * (1 - smoothstep(4.5, 6.5, y)) * (1 - smoothstep(0.18, 0.36, slope)) * padF;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aField', new THREE.BufferAttribute(field, 1));

  // smooth relief; on the plains, crisp farm parcels with hedgerows (Albania: wheat, green, stubble, ploughed, olive
  // groves; Korea: rice paddies), and everywhere on land the Poly Haven aerial photo "aerial_grass_rock" (CC0) as grain
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const detail = new THREE.TextureLoader().load('/world/assets/polyhaven/aerial_grass_rock_diff_2k.jpg', (t) => {
    // to luminance around mid grey, so it modulates the colour without tinting it
    const img = t.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height);
    let mean = 0;
    for (let i = 0; i < d.data.length; i += 4) mean += 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    mean /= d.data.length / 4;
    for (let i = 0; i < d.data.length; i += 4) { const l = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]; d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.max(0, Math.min(255, 128 + (l - mean) * 0.9)); }
    g.putImageData(d, 0, 0); t.image = cv; t.needsUpdate = true;
  });
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping; detail.anisotropy = 8;
  const P = (hex) => new THREE.Color(hex);
  const parcels = { uAl: { value: ['#C2A766', '#8E9752', '#B5A07A', '#8C7455', '#76844A'].map(P) }, uKo: { value: ['#7E9E55', '#94AD62', '#6F8C5C'].map(P) }, uHedge: { value: P('#55623A') }, uDetail: { value: detail } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, parcels);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aField;\nvarying float vField;\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvField = aField;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vField; varying vec3 vWP;
        uniform vec3 uAl[5]; uniform vec3 uKo[3]; uniform vec3 uHedge; uniform sampler2D uDetail;
        float tHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 P = vWP.xz;
          vec2 cell = vec2(6.5, 4.5);
          float row = floor(P.y / cell.y);
          vec2 q = vec2(P.x / cell.x + tHash(vec2(row, 7.0)) * 0.8, P.y / cell.y);
          vec2 id = floor(q), f = fract(q);
          float h = tHash(id);
          vec3 parcel;
          if (vWP.x > 0.0) parcel = h < 0.45 ? uKo[0] : h < 0.8 ? uKo[1] : uKo[2];
          else parcel = h < 0.3 ? uAl[0] : h < 0.52 ? uAl[1] : h < 0.7 ? uAl[2] : h < 0.85 ? uAl[3] : uAl[4];
          float furrow = 0.5 + 0.5 * sin((h > 0.5 ? f.x * cell.x : f.y * cell.y) * 9.0);
          parcel *= 0.93 + 0.07 * furrow;
          if (vWP.x < 0.0 && h >= 0.85) { vec2 g = fract(P * 1.6) - 0.5; parcel = mix(parcel, uHedge, (1.0 - smoothstep(0.16, 0.26, length(g))) * 0.8); } // olive rows
          vec2 e = min(f, 1.0 - f) * cell;
          float edge = min(e.x, e.y), px = fwidth(edge) + 1e-4;
          parcel = mix(parcel, uHedge, (1.0 - smoothstep(0.06, 0.06 + px * 1.5 + 0.1, edge)) * 0.7);
          diffuseColor.rgb = mix(diffuseColor.rgb, parcel, vField);
          float land = smoothstep(1.0, 2.0, vWP.y);
          float dl = texture2D(uDetail, P / 16.0).r * 2.0;
          diffuseColor.rgb *= mix(1.0, dl, 0.5 * land);
        }`);
  };
  const mesh = new THREE.Mesh(geo, m);
  mesh.receiveShadow = true; mesh.castShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// The sea, lit like water: colour from depth (turquoise shallows to deep Adriatic blue), the sky in it through the
// standard material's Fresnel, and every pixel's normal from a sum of wind waves whose time frequencies are whole
// multiples of the loop, so the surface closes on itself every PERIOD. Foam: surf on the shore and, around each ship
// (setShips), a waterline line, a bow wave and, for ships under way, a churned wake with Kelvin arms.
const SEA_W = 560;
const SEA_COL = { beach: tone('#86B9AC'), shallow: tone('#2A7D7E'), mid: tone('#145468'), deep: tone('#0A3550') };
// wind waves: heading offset (rad), wavelength (model units), slope, cycles per loop
const WAVES = [
  [0.0, 7.0, 0.075, 1], [0.55, 5.1, 0.07, 1], [-0.45, 3.7, 0.07, 1], [0.95, 2.9, 0.065, 1],
  [-0.85, 2.2, 0.065, 2], [0.25, 1.7, 0.06, 2], [-0.2, 1.3, 0.06, 2], [1.25, 1.0, 0.055, 2],
  [-1.1, 0.78, 0.05, 3], [0.65, 0.6, 0.05, 3], [-0.55, 0.47, 0.045, 3], [0.1, 0.37, 0.04, 4],
];
const WIND = 0.7; // mean heading of the waves (rad from +x toward +z)
export const WAKE_SPEED = 12; // model units the water slips past a ship under way, per loop

function seaUniforms() {
  return {
    uPhase: { value: 0 },
    uShipA: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }, // x, z, bow direction x, z
    uShipB: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }, // length, beam, under way (0/1), -
    uRefl: { value: null }, uReflMatrix: { value: new THREE.Matrix4() }, uReflOn: { value: 0 }, // planar reflection (world.js)
    uBeach: { value: SEA_COL.beach }, uShallow: { value: SEA_COL.shallow }, uMid: { value: SEA_COL.mid }, uDeep: { value: SEA_COL.deep },
  };
}
function seaMaterial(uniforms, swell) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.035, metalness: 0, envMapIntensity: 1 });
  if (swell) m.defines = { SWELL: '' };
  const waveCode = WAVES.map(([da, lam, s, cyc], i) => {
    const k = (2 * Math.PI) / lam, a = WIND + da;
    return `{ vec2 dir = vec2(${Math.cos(a).toFixed(5)}, ${Math.sin(a).toFixed(5)}); float ph = dot(dir, p) * ${k.toFixed(5)} - t * ${cyc.toFixed(1)} + ${(i * 1.7).toFixed(2)};
      float fade = 1.0 - smoothstep(0.22, 0.55, fw / ${lam.toFixed(3)}); g += dir * (${s.toFixed(4)} * cos(ph) * fade); }`;
  }).join('\n');
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uPhase;
        attribute float aShore; attribute float aDepth;
        varying float vShore; varying float vDepth; varying float vSwell; varying vec3 vWPos;
        uniform mat4 uReflMatrix; varying vec4 vRefl;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vShore = aShore; vDepth = aDepth; vSwell = 0.0;
        #ifdef SWELL
          float a = uPhase * 6.2831853;
          // calmer in the shallows, flat at the edges so the open water beyond meets it without a step
          float edge = smoothstep(0.0, 24.0, min(min(position.x + ${SEA_W / 2}.0, ${SEA_W / 2}.0 - position.x), min(position.z + ${MAP.d / 2}.0, ${MAP.d / 2}.0 - position.z)));
          vSwell = (1.0 - aShore * 0.7) * edge;
          transformed.y += vSwell * (0.11 * sin(position.x * 0.9 + position.z * 0.35 + a) + 0.07 * sin(position.z * 1.3 - position.x * 0.4 - a) + 0.04 * sin(position.x * 2.3 + position.z * 1.9 + 2.0 * a));
        #endif`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vRefl = uReflMatrix * vec4(vWPos, 1.0);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uPhase; uniform vec4 uShipA[4]; uniform vec4 uShipB[4];
        uniform vec3 uBeach; uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep;
        varying float vShore; varying float vDepth; varying float vSwell; varying vec3 vWPos;
        uniform sampler2D uRefl; uniform float uReflOn; varying vec4 vRefl; vec2 seaTilt;
        float seaHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        // value noise whose lattice wraps every per cells along x (the wake scrolls one period per loop)
        float seaNoise(vec2 p, float per) {
          vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
          float x0 = mod(i.x, per), x1 = mod(i.x + 1.0, per);
          return mix(mix(seaHash(vec2(x0, i.y)), seaHash(vec2(x1, i.y)), u.x), mix(seaHash(vec2(x0, i.y + 1.0)), seaHash(vec2(x1, i.y + 1.0)), u.x), u.y);
        }
        float seaBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float seaFoam = 0.0;
        {
          float t = uPhase * 6.2831853;
          vec3 water = mix(uShallow, uMid, smoothstep(0.6, 4.5, vDepth));
          water = mix(water, uDeep, smoothstep(7.0, 24.0, vDepth));
          water = mix(uBeach, water, smoothstep(0.05, 0.9, vDepth));
          diffuseColor.rgb = water;
          vec2 P = vWPos.xz;
          float grain = seaNoise(P * 2.1, 1e6) * 0.6 + seaNoise(P * 5.3, 1e6) * 0.4;
          // surf: a broken line at the waterline and bands rolling in with the loop
          float bands = 0.5 + 0.5 * sin(vShore * 22.0 - t * 2.0 + seaNoise(P * 0.3, 1e6) * 3.0);
          seaFoam += smoothstep(0.86, 0.98, vShore) * smoothstep(0.2, 0.55, grain);
          seaFoam += smoothstep(0.35, 0.92, vShore) * smoothstep(0.8, 0.97, bands) * smoothstep(0.35, 0.65, grain) * 0.75;
          for (int i = 0; i < 4; i++) {
            vec4 A = uShipA[i], B = uShipB[i];
            if (B.x <= 0.0) continue;
            vec2 d = P - A.xy, fwd = A.zw, side = vec2(-fwd.y, fwd.x);
            float al = dot(d, fwd), ac = dot(d, side), hl = B.x * 0.5, hw = B.y * 0.5;
            float taper = clamp((hl - al) / (hw * 2.6), 0.12, 1.0); // the bow narrows to a point
            float dd = seaBox(vec2(ac / taper, al), vec2(hw, hl));
            // water slipping past the hull toward the stern, one period per loop
            vec2 wp = vec2(-al - uPhase * ${WAKE_SPEED.toFixed(1)}, ac);
            float wn = seaNoise(wp / 1.5, ${(WAKE_SPEED / 1.5).toFixed(1)}) * 0.6 + seaNoise(wp / 0.6, ${(WAKE_SPEED / 0.6).toFixed(1)}) * 0.4;
            float near = exp(-max(dd, 0.0) / (B.z > 0.5 ? 0.45 : 0.1));
            seaFoam += near * smoothstep(0.3, 0.7, wn) * (B.z > 0.5 ? 0.9 : 0.3); // moored: a thin line at the waterline
            if (B.z > 0.5) {
              float behind = -(al + hl);
              float tw = hw * (0.85 + max(behind, 0.0) * 0.03);
              float wake = step(0.0, behind) * exp(-behind / (B.x * 0.75)) * (1.0 - smoothstep(tw * 0.4, tw, abs(ac)));
              seaFoam += wake * smoothstep(0.36, 0.7, wn) * 1.1;
              float arm = abs(abs(ac) - (behind + hl * 0.25) * 0.354 - hw * 0.5);
              float arms = step(0.0, behind + hl * 0.25) * exp(-max(behind, 0.0) / (B.x * 0.8)) * (1.0 - smoothstep(0.1, 0.5 + max(behind, 0.0) * 0.02, arm));
              seaFoam += arms * smoothstep(0.42, 0.78, wn) * 0.7;
              seaFoam += smoothstep(hl * 0.55, hl * 0.95, al) * exp(-max(dd, 0.0) / 0.7) * smoothstep(0.28, 0.62, wn) * 1.1; // bow wave
            }
          }
          seaFoam = clamp(seaFoam, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.9), seaFoam);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor + vShore * 0.06, 0.7, seaFoam);`)
      .replace('#include <lights_fragment_end>', `
        // the mirrored scene in place of the sky probe: ships, cranes and quays show in the water, rippled by the waves
        if (uReflOn > 0.5) radiance = texture2D(uRefl, vRefl.xy / vRefl.w + seaTilt * 0.09).rgb;
        #include <lights_fragment_end>`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 p = vWPos.xz;
          float t = uPhase * 6.2831853;
          float fw = length(fwidth(p));
          vec2 g = vec2(0.0);
          ${waveCode}
          g *= 1.0 - vShore * 0.6;
          // the long swell the vertices carry, as an exact slope
          float a = t;
          g += vSwell * vec2(0.11 * 0.9 * cos(p.x * 0.9 + p.y * 0.35 + a) - 0.07 * 0.4 * cos(p.y * 1.3 - p.x * 0.4 - a) + 0.04 * 2.3 * cos(p.x * 2.3 + p.y * 1.9 + 2.0 * a),
                            0.11 * 0.35 * cos(p.x * 0.9 + p.y * 0.35 + a) + 0.07 * 1.3 * cos(p.y * 1.3 - p.x * 0.4 - a) + 0.04 * 1.9 * cos(p.x * 2.3 + p.y * 1.9 + 2.0 * a));
          vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
          nW = normalize(mix(nW, vec3(0.0, 1.0, 0.0), seaFoam * 0.7));
          seaTilt = nW.xz;
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`);
  };
  return m;
}
export function buildSea() {
  const w = SEA_W, d = MAP.d;
  const geo = new THREE.PlaneGeometry(w, d, Math.round(w / 2.4), Math.round(d / 2.4));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const shore = new Float32Array(pos.count), depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    depth[i] = -height(pos.getX(i), pos.getZ(i));
    shore[i] = 1 - smoothstep(0, 2.6, depth[i]); // 1 at the waterline, 0 offshore
  }
  geo.setAttribute('aShore', new THREE.BufferAttribute(shore, 1));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  const uniforms = seaUniforms();
  const mesh = new THREE.Mesh(geo, seaMaterial(uniforms, true));
  mesh.position.y = 0.02;
  mesh.receiveShadow = true;
  mesh.name = 'sea';
  mesh.userData.uniforms = uniforms;
  // open water to the horizon around the board, same surface without the swell
  const R = 6000, outer = new THREE.Shape();
  outer.moveTo(-R, -R); outer.lineTo(R, -R); outer.lineTo(R, R); outer.lineTo(-R, R); outer.closePath();
  const hole = new THREE.Path(); hole.moveTo(-w / 2, -d / 2); hole.lineTo(-w / 2, d / 2); hole.lineTo(w / 2, d / 2); hole.lineTo(w / 2, -d / 2); hole.closePath();
  outer.holes.push(hole);
  const fg = new THREE.ShapeGeometry(outer); fg.rotateX(-Math.PI / 2);
  const n = fg.attributes.position.count;
  fg.setAttribute('aShore', new THREE.BufferAttribute(new Float32Array(n), 1));
  fg.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(n).fill(40), 1));
  const open = new THREE.Mesh(fg, seaMaterial(uniforms, false)); open.receiveShadow = true; open.name = 'open-sea';
  mesh.add(open); // a child of the sea: same height
  return mesh;
}
// ships the sea draws foam for: [{ x, z, dir: [x, z] (bow), len, beam, underway }]
export function setShips(sea, list) {
  const u = sea.userData.uniforms;
  for (let i = 0; i < 4; i++) {
    const s = list[i];
    if (!s) { u.uShipB.value[i].set(0, 0, 0, 0); continue; }
    u.uShipA.value[i].set(s.x, s.z, s.dir[0], s.dir[1]);
    u.uShipB.value[i].set(s.len, s.beam, s.underway ? 1 : 0, 0);
  }
}

// Smooth curves along the road polylines, with a ribbon mesh laid on the terrain.
export function roadCurve(pts) {
  return new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal', 0.5);
}
// Dual carriageway, as on the Durrës–Tirana and Incheon roads (0.2 model units per metre): two 3.25 m lanes each way,
// a concrete median barrier, painted edge lines and lane dashes (4.5 m dash, 7.5 m gap: one ROAD.period of texture,
// so the markings and the asphalt photo wrap along the road), guardrails on both edges, lamp posts on the median.
// Traffic keeps to ROAD.lanes (+ right of the direction of travel).
export const ROAD = { half: 1.7, period: 2.4, lanes: { inner: 0.575, outer: 1.225 } };
function roadMaterial(asphaltImg, relief) {
  const pxu = 300, W = ROAD.half * 2;
  const cv = document.createElement('canvas'); cv.width = Math.round(W * pxu); cv.height = Math.round(ROAD.period * pxu);
  const g = cv.getContext('2d');
  for (let x = 0; x < cv.width; x += cv.height) g.drawImage(asphaltImg, x, 0, cv.height, cv.height); // one photo tile per period
  g.fillStyle = 'rgba(12, 13, 15, 0.42)'; g.fillRect(0, 0, cv.width, cv.height);
  const X = (u) => (u + ROAD.half) * pxu;
  g.fillStyle = 'rgba(120, 118, 112, 0.9)'; g.fillRect(X(-0.16), 0, 0.32 * pxu, cv.height); // median strip under the barrier
  g.fillStyle = '#ECEAE3';
  const solid = (u) => g.fillRect(X(u) - 0.015 * pxu, 0, 0.03 * pxu, cv.height);
  for (const s of [-1, 1]) {
    solid(s * 0.25); solid(s * (ROAD.half - 0.12));
    g.fillRect(X(s * 0.9) - 0.0125 * pxu, 0, 0.025 * pxu, 0.9 * pxu); // lane dash
  }
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.ClampToEdgeWrapping; map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
  const rep = (t) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(W / ROAD.period, 1); return c; };
  return new THREE.MeshStandardMaterial({ map, normalMap: rep(relief.normalMap), roughnessMap: rep(relief.roughnessMap), roughness: 1, side: THREE.DoubleSide });
}
// a strip along the road: cross-section points [offset, height] at every sample
function strip(pts, frames, section, closed = false) {
  const verts = [], idx = [], k = section.length;
  pts.forEach((p, i) => { for (const [o, h] of section) verts.push(p.x + frames[i].x * o, p.y + h, p.z + frames[i].z * o); });
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < k - (closed ? 0 : 1); j++) {
    const a = i * k + j, b = i * k + ((j + 1) % k), c = a + k, d = b + k;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export function buildRoad(curve, { asphaltImg, relief }) {
  const L = curve.getLength(), n = Math.ceil(L / 0.6);
  const pts = curve.getSpacedPoints(n).map((p) => new THREE.Vector3(p.x, height(p.x, p.z) + 0.07, p.z));
  const frames = pts.map((p, i) => { const q = pts[Math.min(n, i + 1)], o = pts[Math.max(0, i - 1)]; return new THREE.Vector3(-(q.z - o.z), 0, q.x - o.x).normalize(); });
  const group = new THREE.Group();
  // carriageways: u across (0..1), v along in periods
  const verts = [], uvs = [], idx = [];
  pts.forEach((p, i) => {
    const s = frames[i];
    verts.push(p.x + s.x * ROAD.half, p.y, p.z + s.z * ROAD.half, p.x - s.x * ROAD.half, p.y, p.z - s.z * ROAD.half);
    const v = (i * L) / n / ROAD.period;
    uvs.push(1, v, 0, v);
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  });
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); rg.setIndex(idx); rg.computeVertexNormals();
  const road = new THREE.Mesh(rg, roadMaterial(asphaltImg, relief)); road.receiveShadow = true; group.add(road);
  // median barrier (New Jersey profile, 80 cm tall) and guardrails (W-beam at 75 cm)
  const concrete = new THREE.MeshStandardMaterial({ color: '#C9C7C0', roughness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: '#B9BEC2', roughness: 0.38, metalness: 0.85, side: THREE.DoubleSide });
  const bar = new THREE.Mesh(strip(pts, frames, [[-0.09, 0], [-0.035, 0.06], [-0.025, 0.16], [0.025, 0.16], [0.035, 0.06], [0.09, 0]]), concrete);
  bar.castShadow = true; bar.receiveShadow = true; group.add(bar);
  for (const side of [-1, 1]) {
    const o = side * (ROAD.half - 0.03);
    const rail = new THREE.Mesh(strip(pts, frames, [[o, 0.1], [o, 0.155]]), steel); rail.castShadow = true; group.add(rail);
  }
  // posts every 0.8 units on both edges, lamps every 10 units on the median
  const postGeo = new THREE.BoxGeometry(0.022, 0.15, 0.022); postGeo.translate(0, 0.075, 0);
  const lampGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.016, 0.022, 2.0, 6).translate(0, 1.0, 0),
    new THREE.BoxGeometry(0.03, 0.025, 1.0).translate(0, 1.98, 0),
  ]);
  const headGeo = mergeGeometries([new THREE.BoxGeometry(0.06, 0.03, 0.13).translate(0, 1.96, 0.5), new THREE.BoxGeometry(0.06, 0.03, 0.13).translate(0, 1.96, -0.5)]);
  const postAt = [], lampAt = [];
  let acc = 0, accL = 4;
  for (let i = 1; i <= n; i++) {
    const step = pts[i].distanceTo(pts[i - 1]); acc += step; accL += step;
    if (acc >= 0.8) { acc = 0; for (const side of [-1, 1]) postAt.push([pts[i].x + frames[i].x * side * (ROAD.half - 0.02), pts[i].y, pts[i].z + frames[i].z * side * (ROAD.half - 0.02), 0]); }
    if (accL >= 10) { accL = 0; lampAt.push([pts[i].x, pts[i].y + 0.16, pts[i].z, Math.atan2(frames[i].x, frames[i].z)]); }
  }
  const inst = (geo, material, at) => {
    const im = new THREE.InstancedMesh(geo, material, at.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    at.forEach(([x, y, z, ry], i) => { m4.compose(p.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), one); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true; return im;
  };
  group.add(inst(postGeo, steel, postAt), inst(lampGeo, steel, lampAt), inst(headGeo, new THREE.MeshStandardMaterial({ color: '#F4F1E8', emissive: '#FFF3D6', emissiveIntensity: 0.25, roughness: 0.4 }), lampAt));
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

