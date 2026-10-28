// Assembles the relief model, its camera timeline and the offline render chain (shadows, GTAO, depth of field).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { pbr } from './pbr.js';
import { STATIONS, height, MAP, rectDist } from './geo.js';
import { rng } from './noise.js';
import { buildTerrain, buildSea, setShips, buildRoad, roadK, roadA } from './terrain.js';
import { buildStations } from './stations.js';
import { apartmentBlocks, loadModels } from './cars.js';
import * as K from './kit.js';
import { layout, sceneTimes, ease, PERIOD } from './timeline.js';

const D2R = Math.PI / 180;

// Camera stands per stop. az: degrees around the target from +z (south) toward +x (east).
function posesFor(variant, stations) {
  const phone = variant === 'phone';
  void stations;
  const base = [
    { t: [325, 3.2, -27], az: 40, el: 40, dist: 46, fov: 24 }, // Incheon yard
    { t: [225, 2.6, 47], az: 56, el: 33, dist: 46, fov: 24 }, // Incheon port, from the land side, the ramp in view
    { t: [-2, 3.2, 2], az: 22, el: 4.5, dist: 64, fov: 24, shift: 0.04, haze: 9, phoneDist: 2.3 }, // at sea, from a boat: horizon and sky in frame
    { t: [-234, 2.4, 8], az: -50, el: 34, dist: 46, fov: 24 }, // Durrës port, from the land side
    { t: [-338, 3.4, -35], az: 32, el: 16, dist: 42, fov: 24 }, // Tirana showroom, the painted blocks behind it
  ];
  return base.map((p) => clearView({
    ...p,
    dist: p.dist * (phone ? (p.phoneDist ?? 1.5) : 1.12), // the narrow phone frame stands further back
    fov: p.fov + (phone ? 8 : 0),
    shift: p.shift ?? (phone ? 0.18 : 0.15),
    haze: p.haze ?? 4.2, // fog reaches full strength at haze x the camera distance
  }));
}
// Swing the camera round until no ridge stands between it and its subject.
function clearView(p) {
  const blocked = (q) => {
    const { pos, target } = camFromPose(q);
    for (let i = 1; i < 80; i++) {
      const v = pos.clone().lerp(target, i / 80);
      if (height(v.x, v.z) > v.y - 1.2) return true;
    }
    return false;
  };
  for (const del of [0, 8, 16, 24]) for (const da of [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90, 120, -120, 150, -150, 180]) {
    const q = { ...p, az: p.az + da, el: p.el + del };
    if (!blocked(q)) return q;
  }
  return p;
}
const overview = (variant) => ({ t: [300, 0, -22], az: 52, el: 46, dist: variant === 'phone' ? 300 : 230, fov: 26, shift: 0, haze: 4.2 });

function camFromPose(p) {
  const el = p.el * D2R, az = p.az * D2R;
  const t = new THREE.Vector3(...p.t);
  const off = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(p.dist);
  return { pos: t.clone().add(off), target: t };
}
function lerpAngle(a, b, k) { let d = ((b - a + 540) % 360) - 180; return a + d * k; }
function interpPose(A, B, x, intro) {
  const k = intro ? ease.out(x) : ease.inOut(x);
  const hump = Math.sin(Math.PI * k);
  const span = Math.hypot(B.t[0] - A.t[0], B.t[2] - A.t[2]);
  return {
    t: [A.t[0] + (B.t[0] - A.t[0]) * k, A.t[1] + (B.t[1] - A.t[1]) * k, A.t[2] + (B.t[2] - A.t[2]) * k],
    az: lerpAngle(A.az, B.az, k),
    el: A.el + (B.el - A.el) * k + (intro ? 0 : 16 * hump),
    dist: (A.dist + (B.dist - A.dist) * k) * (intro ? 1 : 1 + Math.min(1.6, span / 70) * hump),
    fov: A.fov + (B.fov - A.fov) * k,
    shift: A.shift + (B.shift - A.shift) * k,
    haze: A.haze + (B.haze - A.haze) * k,
  };
}

// The HDR sky in place: clip the sun disc to the brightest sky around it, and read where the sun stood
// (azimuth as atan2(z, x) in the texture's frame) and the mean colour 1–5° above the horizon (linear).
function prepareSky(hdr) {
  const { data, width: W, height: H } = hdr.image;
  const half = data instanceof Uint16Array;
  const get = half ? (i) => THREE.DataUtils.fromHalfFloat(data[i]) : (i) => data[i];
  const put = half ? (i, v) => { data[i] = THREE.DataUtils.toHalfFloat(v); } : (i, v) => { data[i] = v; };
  const lum = (p) => 0.2126 * get(p * 4) + 0.7152 * get(p * 4 + 1) + 0.0722 * get(p * 4 + 2);
  let best = -1, bi = 0;
  for (let p = 0; p < W * H; p++) { const l = lum(p); if (l > best) { best = l; bi = p; } }
  const CAP = 6;
  for (let p = 0; p < W * H; p++) { const l = lum(p); if (l > CAP) for (let c = 0; c < 3; c++) put(p * 4 + c, (get(p * 4 + c) * CAP) / l); }
  hdr.needsUpdate = true;
  // rows run from the zenith (row 0, flipped on upload) to the nadir
  const u = ((bi % W) + 0.5) / W;
  const horizon = new THREE.Color(0, 0, 0);
  let n = 0;
  for (let py = Math.floor(H * (0.5 - 5 / 180)); py <= Math.floor(H * (0.5 - 1 / 180)); py++) for (let px = 0; px < W; px += 4) {
    const p = py * W + px; horizon.r += get(p * 4); horizon.g += get(p * 4 + 1); horizon.b += get(p * 4 + 2); n++;
  }
  horizon.multiplyScalar(1 / n);
  return { sunAz: (u - 0.5) * Math.PI * 2, horizon, horizonLum: 0.2126 * horizon.r + 0.7152 * horizon.g + 0.0722 * horizon.b };
}

// Two lights for the same film: midday, and golden hour (low warm sun from the west over the sea, sunset sky)
const LOOKS = {
  day: { sky: 'sky_2k.hdr', sun: [-0.52, 0.66, 0.54], sunColor: '#FFE6C8', sunI: 3.0, hemi: ['#D3E6F0', '#C8B48E', 0.45], env: 0.75, exposure: 1.02, clouds: 0.48, grade: { tone: 1, sat: 1.05, vig: 0.16 } },
  golden: { sky: 'sky_golden_2k.hdr', sun: [-0.8, 0.26, 0.55], sunColor: '#FFA764', sunI: 7.0, hemi: ['#FFD6B0', '#5E4D3E', 0.22], env: 0.42, exposure: 1.06, clouds: 0.32, grade: { tone: 2.3, sat: 1.1, vig: 0.22 } },
};
// gentle grade after the output transform: a soft S-curve, cool shadows and warm highlights, a little saturation, vignette
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTone: { value: 1 }, uSat: { value: 1.05 }, uVig: { value: 0.16 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTone, uSat, uVig; varying vec2 vUv;
    void main() {
      vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb;
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.16);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c += (vec3(-0.010, 0.0, 0.016) * (1.0 - l) + vec3(0.018, 0.007, -0.012) * l) * uTone;
      c = mix(vec3(l), c, uSat);
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.82);
      c *= 1.0 - uVig * smoothstep(0.32, 0.86, length(q));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a);
    }`,
};
// Cloud shadows on every lit material: the sun's direct light dimmed under drifting cloud noise, sampled where the sun
// ray through each point meets a cloud deck. To move and still close every loop, two copies of the noise DRIFT apart
// slide by DRIFT per loop and crossfade.
const CLOUD_GLSL = `uniform float uCloudPhase; uniform vec3 uSunDir; uniform float uCloudK; uniform mat4 uCamWorld;
  float cHash(vec2 p) { return fract(sin(dot(p, vec2(27.17, 113.9))) * 43758.5453); }
  float cNoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(cHash(i), cHash(i + vec2(1.0, 0.0)), u.x), mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), u.x), u.y); }
  float cFbm(vec2 p) { float v = 0.0, a = 0.55; for (int i = 0; i < 3; i++) { v += a * cNoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v / 0.9625; }
  float cloudShade() {
    vec3 wp = (uCamWorld * vec4(-vViewPosition, 1.0)).xyz; // camera world matrix, set per pass
    vec2 P = wp.xz - uSunDir.xz / max(uSunDir.y, 0.15) * (90.0 - wp.y);
    vec2 drift = vec2(14.0, 5.0);
    float u = uCloudPhase;
    float c = mix(cFbm((P - drift * u) / 58.0), cFbm((P - drift * (u - 1.0)) / 58.0), u);
    return 1.0 - uCloudK * smoothstep(0.47, 0.66, c);
  }`;
function addCloudShadows(root, uniforms) {
  const done = new Set();
  root.traverse((o) => {
    for (const m of o.material ? [].concat(o.material) : []) {
      if (done.has(m) || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) continue;
      done.add(m);
      const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey();
      m.onBeforeCompile = (sh, r) => {
        prev.call(m, sh, r);
        Object.assign(sh.uniforms, uniforms);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + CLOUD_GLSL)
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n{ float cs = cloudShade(); reflectedLight.directDiffuse *= cs; reflectedLight.directSpecular *= cs; }');
      };
      m.customProgramCacheKey = () => prevKey + '|clouds';
    }
  });
}

export async function createWorld({ width, height: H, variant = 'desktop', canvas, quality = 'film', look = 'day' }) {
  const LK = LOOKS[look] || LOOKS.day;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LK.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const sunDir = new THREE.Vector3(...LK.sun).normalize();

  const hemi = new THREE.HemisphereLight(...LK.hemi); scene.add(hemi);
  // the real sky, as backdrop, light and reflections: Poly Haven "kloofendal_48d_partly_cloudy_puresky" (CC0).
  // Its sun disc is clipped (the directional light is the sun), the sky is turned so its sun stands where ours
  // does, and the haze takes the colour of its horizon, so far water and land melt into it
  const hdr = await new RGBELoader().loadAsync(`/world/assets/polyhaven/${LK.sky}`);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const sky = prepareSky(hdr);
  const turn = sky.sunAz - Math.atan2(sunDir.z, sunDir.x);
  scene.background = hdr;
  scene.backgroundRotation.set(0, turn, 0); scene.environmentRotation.set(0, turn, 0);
  scene.backgroundIntensity = 0.8 / sky.horizonLum; // the horizon about as bright as the old haze
  const haze = sky.horizon.clone().multiplyScalar(scene.backgroundIntensity * 0.8); // a touch under the sky, so the horizon reads as a line, not a glare
  scene.fog = new THREE.Fog(haze, 200, 600);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = LK.env;
  const sun = new THREE.DirectionalLight(LK.sunColor, LK.sunI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  await loadModels();
  const terrain = buildTerrain(); scene.add(terrain);
  const sea = buildSea(); scene.add(sea);
  const asphaltImg = await new THREE.ImageLoader().loadAsync('/world/assets/polyhaven/asphalt_02_diff_1k.jpg');
  const relief = pbr('asphalt_02', 1);
  scene.add(buildRoad(roadK, { asphaltImg, relief }), buildRoad(roadA, { asphaltImg, relief }));
  // yard surfaces: concrete in the ports and at the showroom, asphalt in the Incheon lot
  for (const st of STATIONS) {
    if (!st.rect) continue;
    const [x0, x1, z0, z1] = st.rect, w = x1 - x0, d = z1 - z0;
    const asph = st.ground === 'asphalt';
    const tile = asph ? 2.2 : 7; // concrete slabs read better large
    const m = pbr(asph ? 'asphalt_02' : 'concrete_floor_02', 1, [w / tile, d / tile], { grey: !asph }); m.color.set(asph ? '#9A9EA3' : '#E6E8E4');
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    yard.rotation.x = -Math.PI / 2; yard.position.set((x0 + x1) / 2, st.pad + 0.012, (z0 + z1) / 2); yard.receiveShadow = true;
    scene.add(yard);
  }

  // scatter: Albania — olives, cypresses, terracotta villages, bunkers; Korea — red pines, apartment slabs
  const r = rng(2024);
  const trees = [], houses = [], bunkers = [];
  const near = (x, z, rr) => STATIONS.some((s) => s.pad != null && rectDist(s, x, z) < 4 * rr);
  const offRoad = (x, z, d) => { const info = nearestDist(x, z); return info > d; };
  const roadPts = roadK.getSpacedPoints(200).concat(roadA.getSpacedPoints(300));
  function nearestDist(x, z) { let b = 1e9; for (const p of roadPts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < b) b = d; } return Math.sqrt(b); }
  for (let i = 0; i < 9000; i++) {
    const x = (r() - 0.5) * MAP.w * 0.96, z = (r() - 0.5) * MAP.d * 0.96;
    const y = height(x, z);
    if (y < 1.0 || near(x, z, 1) || !offRoad(x, z, 2.6)) continue;
    const kind = x > 0 ? (y > 3 || r() < 0.4 ? 'pine' : 'olive') : y > 15 ? 'pine' : y > 6 ? (r() < 0.7 ? 'olive' : 'pine') : (r() < 0.82 ? 'olive' : 'cypress');
    if (y > 40) continue;
    trees.push({ x, y, z, kind, s: 0.8 + r() * 0.7 });
  }
  // villages: clusters of houses with cypress rows
  for (let v = 0; v < 70; v++) {
    const cx = (r() - 0.5) * MAP.w * 0.9, cz = (r() - 0.5) * MAP.d * 0.9;
    const cy = height(cx, cz);
    if (cy < 1.2 || cy > 20 || near(cx, cz, 1.1) || cx > 0) continue;
    const n = 4 + Math.floor(r() * 10);
    for (let i = 0; i < n; i++) {
      const x = cx + (r() - 0.5) * 9, z = cz + (r() - 0.5) * 9, y = height(x, z);
      if (!offRoad(x, z, 2.4) || y < 1) continue;
      houses.push({ x, y, z, s: 0.9 + r() * 0.5 });
      if (r() < 0.35) trees.push({ x: x + 1.1, y: height(x + 1.1, z), z, kind: 'cypress', s: 1 + r() * 0.4 });
    }
  }
  for (let i = 0; i < 260; i++) {
    const z = (r() - 0.5) * MAP.d * 0.9, x = -280 - r() * 70;
    const y = height(x, z);
    if (y < 1.2 || y > 12 || near(x, z, 1) || !offRoad(x, z, 2)) continue;
    bunkers.push({ x, y, z, s: 0.6 + r() * 0.5 });
  }
  // Korean towns: clusters of apartment slabs on the plain
  const apts = [];
  for (let v = 0; v < 16; v++) {
    const cx = 240 + r() * 200, cz = (r() - 0.5) * MAP.d * 0.85;
    if (height(cx, cz) < 1.5 || height(cx, cz) > 9 || near(cx, cz, 2.2)) continue;
    for (let i = 0; i < 6; i++) { const x = cx + (i % 3) * 5, z = cz + Math.floor(i / 3) * 6; if (offRoad(x, z, 4)) apts.push({ x, y: height(x, z), z, ry: 0.2 }); }
  }
  const nearView = (x, z) => STATIONS.some((s) => Math.hypot(x - s.x, z - s.z) < 64); // full trees where the camera comes close
  scene.add(K.scatterTrees(trees, { near: nearView }), K.scatterHouses(houses), K.scatterBunkers(bunkers), apartmentBlocks(apts));

  const stations = buildStations();
  stations.forEach((s) => scene.add(s.group));
  // the sea draws foam round every container ship: waterline, bow wave, and a wake for those under way
  scene.updateMatrixWorld(true);
  const ships = [];
  scene.traverse((o) => {
    if (!o.userData.isShip) return;
    const p = o.getWorldPosition(new THREE.Vector3()), d = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld);
    const h = Math.hypot(d.x, d.z);
    ships.push({ x: p.x, z: p.z, dir: [d.x / h, d.z / h], len: o.userData.len, beam: o.userData.w, underway: !!o.userData.underway });
  });
  setShips(sea, ships);
  const cloudU = { uCloudPhase: { value: 0 }, uSunDir: { value: sunDir }, uCloudK: { value: LK.clouds }, uCamWorld: { value: new THREE.Matrix4() } };
  addCloudShadows(scene, cloudU);
  const poses = posesFor(variant, stations);
  const ov = overview(variant);
  const L = layout(stations.length);

  const camera = new THREE.PerspectiveCamera(24, width / H, 0.5, 2000);
  camera.layers.enable(K.TREE_LAYER); sun.shadow.camera.layers.enable(K.TREE_LAYER); // trees: seen and shadowed, not mirrored in the sea
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(width, H, { type: THREE.HalfFloatType, samples: quality === 'draft' ? 0 : 4 }));
  composer.setPixelRatio(1); composer.setSize(width, H);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (quality !== 'draft') {
    gtao = new GTAOPass(scene, camera, width, H);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    composer.addPass(gtao);
  }
  const bokeh = new BokehPass(scene, camera, { focus: 60, aperture: 0.00018, maxblur: 0.0055 });
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uTone.value = LK.grade.tone; grade.uniforms.uSat.value = LK.grade.sat; grade.uniforms.uVig.value = LK.grade.vig;
  composer.addPass(grade);

  function applyPose(p) {
    const { pos, target } = camFromPose(p);
    camera.fov = p.fov; camera.position.copy(pos); camera.lookAt(target);
    camera.setViewOffset(width, H, 0, H * p.shift, width, H); // lens shift: the subject sits above centre, clear of the copy band
    camera.updateProjectionMatrix();
    const dist = pos.distanceTo(target);
    scene.fog.near = dist * 1.5; scene.fog.far = dist * p.haze;
    camera.near = Math.max(0.5, dist * 0.08); camera.far = p.haze > 6 ? 6000 : dist * 6; // a low sea shot sees the water to the horizon camera.updateProjectionMatrix();
    bokeh.uniforms.focus.value = dist;
    bokeh.uniforms.aperture.value = 0.00018 * Math.min(1, 62 / dist);
    bokeh.uniforms.nearClip.value = camera.near; bokeh.uniforms.farClip.value = camera.far;
    // shadow box follows the view
    const half = THREE.MathUtils.clamp(dist * 0.62, 34, 220);
    const sc = sun.shadow.camera;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = half * 6; sc.updateProjectionMatrix();
    const texel = (2 * half) / 4096;
    const tt = target.clone(); tt.x = Math.round(tt.x / texel) * texel; tt.z = Math.round(tt.z / texel) * texel;
    sun.target.position.copy(tt); sun.position.copy(tt).addScaledVector(sunDir, half * 3);
    sun.target.updateMatrixWorld();
    return dist;
  }

  function poseAt(f) {
    const { seg, t, times } = sceneTimes(L, f, stations.length);
    let p;
    if (seg.type === 'idle') p = poses[seg.scene];
    else {
      const A = seg.from < 0 ? ov : poses[seg.from];
      const B = poses[seg.to];
      p = interpPose(A, B, t / (seg.len / L.fps), seg.from < 0);
    }
    return { p, seg, times };
  }

  const v = new THREE.Vector3();
  function setFrame(f) {
    const { p, seg, times } = poseAt(f);
    stations.forEach((s, i) => s.update(times[i]));
    sea.userData.uniforms.uPhase.value = times[0] / PERIOD;
    cloudU.uCloudPhase.value = times[0] / PERIOD;
    applyPose(p);
    scene.updateMatrixWorld(true);
    return { seg, times };
  }
  function anchorsNow(ids) {
    const out = {};
    for (const s of stations) for (const a of s.anchors) {
      if (ids && !ids.includes(a.id)) continue;
      a.obj.getWorldPosition(v); v.project(camera);
      const inFront = v.z < 1;
      out[a.id] = inFront ? [Math.round((v.x * 0.5 + 0.5) * 10000) / 10000, Math.round((0.5 - v.y * 0.5) * 10000) / 10000] : null;
    }
    return out;
  }
  // Planar reflection: the scene above the water, from the camera mirrored in the sea plane (built the way three's
  // Reflector does it: mirrored position, target and up, so no handedness flip), into a half-size target the sea samples
  const WATER = 0.02;
  const reflRT = new THREE.WebGLRenderTarget(Math.round(width / 2), Math.round(H / 2), { type: THREE.HalfFloatType, samples: quality === 'draft' ? 0 : 4 });
  const mirror = new THREE.PerspectiveCamera();
  const clipWater = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER)];
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const su = sea.userData.uniforms;
  su.uRefl.value = reflRT.texture; su.uReflOn.value = 1;
  const rot = new THREE.Matrix4(), aim = new THREE.Vector3(), up = new THREE.Vector3(), camPos = new THREE.Vector3();
  function renderReflection() {
    camera.updateMatrixWorld();
    camPos.setFromMatrixPosition(camera.matrixWorld);
    rot.extractRotation(camera.matrixWorld);
    aim.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    mirror.position.set(camPos.x, 2 * WATER - camPos.y, camPos.z);
    up.set(0, 1, 0).applyMatrix4(rot); up.y = -up.y;
    mirror.up.copy(up);
    mirror.lookAt(aim.x, 2 * WATER - aim.y, aim.z);
    mirror.updateMatrixWorld();
    mirror.projectionMatrix.copy(camera.projectionMatrix);
    su.uReflMatrix.value.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    sea.visible = false;
    const prevClip = renderer.clippingPlanes;
    renderer.clippingPlanes = clipWater;
    cloudU.uCamWorld.value.copy(mirror.matrixWorld);
    renderer.setRenderTarget(reflRT); renderer.clear(); renderer.render(scene, mirror);
    renderer.setRenderTarget(null); renderer.clippingPlanes = prevClip;
    sea.visible = true;
  }
  function render() {
    renderReflection();
    renderer.shadowMap.autoUpdate = false; // the reflection pass just drew this frame's shadows
    renderer.shadowMap.needsUpdate = false;
    cloudU.uCamWorld.value.copy(camera.matrixWorld);
    composer.render();
    renderer.shadowMap.autoUpdate = true;
  }

  return { renderer, scene, camera, composer, stations, layout: L, poses, setFrame, anchorsNow, render, applyPose, sun, look };
}
