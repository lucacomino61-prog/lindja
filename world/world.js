// Assembles the relief model, its camera timeline and the offline render chain (shadows, GTAO, depth of field).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { pbr } from './pbr.js';
import { STATIONS, height, MAP, rectDist } from './geo.js';
import { rng } from './noise.js';
import { buildTerrain, buildSea, buildRoad, roadK, roadA } from './terrain.js';
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
    { t: [225, 2.6, 42], az: 56, el: 33, dist: 46, fov: 24 }, // Incheon port, from the land side
    { t: [-2, 2.5, 2], az: 22, el: 24, dist: 64, fov: 24 }, // at sea
    { t: [-234, 2.4, 8], az: -50, el: 34, dist: 46, fov: 24 }, // Durrës port, from the land side
    { t: [-338, 3.4, -35], az: 32, el: 34, dist: 42, fov: 24 }, // Tirana showroom, Dajti behind
  ];
  return base.map((p) => clearView({
    ...p,
    dist: p.dist * (phone ? 1.5 : 1.12),
    fov: p.fov + (phone ? 8 : 0),
    shift: phone ? 0.18 : 0.15,
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
const overview = (variant) => ({ t: [300, 0, -22], az: 52, el: 46, dist: variant === 'phone' ? 300 : 230, fov: 26, shift: 0 });

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
  };
}

export async function createWorld({ width, height: H, variant = 'desktop', canvas, quality = 'film' }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const haze = new THREE.Color('#DCE5E4');
  scene.background = haze.clone();
  scene.fog = new THREE.Fog(haze, 200, 600);

  const hemi = new THREE.HemisphereLight('#D3E6F0', '#C8B48E', 0.45); scene.add(hemi);
  // real sky light and reflections: Poly Haven "kloofendal_48d_partly_cloudy_puresky" (CC0)
  const hdr = await new RGBELoader().loadAsync('/world/assets/polyhaven/sky_2k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(hdr).texture; hdr.dispose();
  scene.environmentIntensity = 0.6;
  const sun = new THREE.DirectionalLight('#FFE6C8', 3.0);
  const sunDir = new THREE.Vector3(-0.52, 0.66, 0.54).normalize();
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  await loadModels();
  const terrain = buildTerrain(); scene.add(terrain);
  const sea = buildSea(); scene.add(sea);
  const asphalt = pbr('asphalt_02', 1);
  scene.add(buildRoad(roadK, { width: 1.9, material: asphalt }));
  scene.add(buildRoad(roadA, { width: 1.9, material: asphalt }));
  // yard surfaces: concrete in the ports and at the showroom, asphalt in the Incheon lot
  for (const st of STATIONS) {
    if (!st.rect) continue;
    const [x0, x1, z0, z1] = st.rect, w = x1 - x0, d = z1 - z0;
    const m = pbr(st.ground === 'asphalt' ? 'asphalt_02' : 'concrete_floor_02', 1, [w / 2.2, d / 2.2]); m.color.set(st.ground === 'asphalt' ? '#9A9EA3' : '#969894');
    if (st.ground !== 'asphalt') m.map = null; // Poly Haven's concrete colour map is beige: keep its relief and roughness on a neutral grey
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
  scene.add(K.scatterTrees(trees), K.scatterHouses(houses), K.scatterBunkers(bunkers), apartmentBlocks(apts));

  const stations = buildStations();
  stations.forEach((s) => scene.add(s.group));
  const poses = posesFor(variant, stations);
  const ov = overview(variant);
  const L = layout(stations.length);

  const camera = new THREE.PerspectiveCamera(24, width / H, 0.5, 2000);
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

  function applyPose(p) {
    const { pos, target } = camFromPose(p);
    camera.fov = p.fov; camera.position.copy(pos); camera.lookAt(target);
    camera.setViewOffset(width, H, 0, H * p.shift, width, H); // lens shift: the subject sits above centre, clear of the copy band
    camera.updateProjectionMatrix();
    const dist = pos.distanceTo(target);
    scene.fog.near = dist * 1.5; scene.fog.far = dist * 4.2;
    camera.near = Math.max(0.5, dist * 0.08); camera.far = dist * 6; camera.updateProjectionMatrix();
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
  function render() { composer.render(); }

  return { renderer, scene, camera, composer, stations, layout: L, poses, setFrame, anchorsNow, render, applyPose, sun };
}
