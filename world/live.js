// The world in the page: the same relief model the film was rendered from, drawn live and driven by the scroll.
// u (0..4) is the place along the route: 0 Incheon yard, 1 Incheon port, 2 at sea, 3 Durrës, 4 Tirana. Between two
// stops the camera flies, LINDJA STAR sails (one ship: she folds her ramp at Incheon and lowers it at Durrës, turned
// round so the same side meets the quay) and the weather turns: a clear morning, clouds over the port, a squall at
// sea, Durrës washed clean, golden hour in Tirana. Time (the second argument) runs the loops: cars, cranes, waves.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { createWorld, interpPose } from './world.js';
import { PERIOD } from './timeline.js';
import { height } from './geo.js';
import { setShips } from './terrain.js';
import { treeTiles } from './kit.js';
import { lodU } from './impostor.js';

// light tree models within this distance of the camera, cards beyond (world/impostor.js)
const LOD_D = { high: 75, mid: 50, low: 28 };
const SHADOW_EVERY = { high: 1, mid: 1, low: 3 };

const { clamp, smoothstep: sm, lerp } = THREE.MathUtils;
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// weather per stop; between stops every value eases across the flight
const WEATHER = [
  { sunI: 3.0, clouds: 0.32, over: 0.0, rain: 0, fogK: 1.0, env: 0.75, expo: 1.02, chop: 1.0, sat: 1.06, gold: 0 }, // Incheon: a clear morning
  { sunI: 2.6, clouds: 0.55, over: 0.2, rain: 0, fogK: 1.15, env: 0.7, expo: 1.0, chop: 1.15, sat: 1.02, gold: 0 }, // the port: clouds coming in
  { sunI: 0.75, clouds: 0.92, over: 0.86, rain: 1, fogK: 2.6, env: 0.5, expo: 0.98, chop: 1.75, sat: 0.84, gold: 0 }, // at sea: a squall
  { sunI: 2.9, clouds: 0.42, over: 0.1, rain: 0, fogK: 1.0, env: 0.76, expo: 1.03, chop: 1.0, sat: 1.08, gold: 0 }, // Durrës: washed clear
  { sunI: 7.0, clouds: 0.3, over: 0.0, rain: 0, fogK: 1.0, env: 0.42, expo: 1.06, chop: 0.9, sat: 1.1, gold: 1 }, // Tirana: golden hour
];
function weatherAt(u) {
  const k = Math.min(3, Math.floor(u)), f = sm(u - k, 0.12, 0.88), A = WEATHER[k], B = WEATHER[k + 1], out = {};
  for (const key in A) out[key] = lerp(A[key], B[key], f);
  return out;
}

// the voyage, in board units (y = waterline): Incheon berth → open sea (heading west, where the sea stop frames her)
// → round the container ship at Durrës → alongside, bow south
const LEG1 = [[218.5, 54], [218.2, 66], [214.5, 78], [204, 87], [186, 88], [150, 72], [100, 44], [60, 12], [30, 0], [0, 0]];
const LEG2 = [[0, 0], [-30, 0], [-70, 6], [-120, 22], [-165, 40], [-192, 44], [-204, 34], [-207, 18], [-212, 6], [-218.5, 0]];
const curve = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal', 0.5);
const angLerp = (a, b, k) => a + ((((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * k;

const SKY_V = 'varying vec3 vDir; void main() { vDir = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; }';
const SKY_F = `uniform sampler2D tDay, tGold; uniform float uMix, uOver, uRotDay, uRotGold, uIntDay, uIntGold; varying vec3 vDir;
  vec2 equi(vec3 d, float r) { float c = cos(r), s = sin(r); d = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
    return vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5); }
  void main() {
    vec3 d = normalize(vDir);
    vec3 c = mix(texture2D(tDay, equi(d, uRotDay)).rgb * uIntDay, texture2D(tGold, equi(d, uRotGold)).rgb * uIntGold, uMix);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // overcast: the deck closes into a flat, cooler grey, darker overhead than at the horizon
    vec3 deck = vec3(0.86, 0.9, 0.95) * (0.42 + 0.28 * smoothstep(0.35, -0.05, d.y)) * (0.55 + 0.45 * l / (l + 0.6));
    c = mix(c, deck, uOver);
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
// rain: streaks in the camera's frustum (x, y in view units, z = depth), each falling and wrapping on its own clock
const RAIN_V = `attribute float aEnd, aSeed; uniform float uTime; uniform vec2 uTan; varying float vA;
  void main() {
    float d = mix(3.0, 46.0, position.z);
    float y = 1.15 - 2.3 * fract(position.y + uTime * (0.9 + 0.5 * aSeed) * (14.0 / d));
    vec3 q = vec3(position.x * d * uTan.x * 1.15, y * d * uTan.y, -d);
    q += aEnd * vec3(-0.008, -0.034, 0.0) * d; // a streak, slanted by the wind
    vA = (0.45 + 0.55 * aSeed) * (1.0 - 0.6 * position.z); // far drops fainter
    gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
  }`;
const RAIN_F = 'uniform float uRain; varying float vA; void main() { gl_FragColor = vec4(0.84, 0.88, 0.92, 0.15 * uRain * vA); }';

function makeRain(n) {
  const pos = new Float32Array(n * 6), end = new Float32Array(n * 2), seed = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 2 - 1, y = Math.random(), z = Math.pow(Math.random(), 1.6), s = Math.random();
    for (let e = 0; e < 2; e++) { pos.set([x, y, z], i * 6 + e * 3); end[i * 2 + e] = e; seed[i * 2 + e] = s; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({ vertexShader: RAIN_V, fragmentShader: RAIN_F, transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uTan: { value: new THREE.Vector2() }, uRain: { value: 0 } } });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false; lines.renderOrder = 10;
  return lines;
}

// onProgress(phase, 0..1): 'load' (files: models, pictures, skies), 'build', 'compile' (the page's preloader shows it)
export async function createLive({ canvas, width, height: H, dpr = 1, variant = 'desktop', tier = 'high', sky, skyGold, onProgress = () => {} }) {
  const live = { tier, dpr, sky };
  // every loader here goes through three's default manager; about 30 files in all, so the count never runs ahead
  let best = 0;
  THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => { const f = Math.min(1, loaded / Math.max(total, 30)); if (f > best) { best = f; onProgress('load', f); } };
  const w = await createWorld({ width, height: H, variant, canvas, quality: 'film', look: 'day', live });
  onProgress('build', 1);
  const { scene, camera, renderer, sun, hemi, sunDir, cloudU, grade, sea, LOOKS } = w;
  const day = LOOKS.day, gold = LOOKS.golden;

  // ---------- one ship for the whole voyage ----------
  const st = Object.fromEntries(w.stations.map((s) => [s.id, s]));
  const ship = st.port.live.roro, berth1 = ship.position.clone(), berth3 = st.durres.live.roro.position.clone();
  scene.attach(ship); // off the Incheon group, which is hidden whenever Incheon is out of view
  st.durres.live.roro.visible = false; st.deti.live.ship.visible = false;
  const leg1 = curve(LEG1), leg2 = curve(LEG2);
  for (const c of [leg1, leg2]) for (let i = 0; i <= 60; i++) { const p = c.getPointAt(i / 60); if (height(p.x, p.z) > -0.8) console.warn('route over shallows', p.x.toFixed(1), p.z.toFixed(1)); }
  const shipAnchor = w.stations.flatMap((s) => s.anchors).find((a) => a.id === 'deti-ship');
  const others = [];
  scene.traverse((o) => { if (o.userData.isShip && o !== ship && o !== st.durres.live.roro && o !== st.deti.live.ship) others.push(o); });
  const otherShips = others.map((o) => { const p = o.getWorldPosition(new THREE.Vector3()), d = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld), h = Math.hypot(d.x, d.z); return { x: p.x, z: p.z, dir: [d.x / h, d.z / h], len: o.userData.len, beam: o.userData.w, underway: !!o.userData.underway }; });
  const tan = new THREE.Vector3();
  function voyage(u, time) {
    let x = berth1.x, z = berth1.z, rot = 0, ramp = 1, moving = false;
    if (u >= 3) { x = berth3.x; z = berth3.z; rot = Math.PI; }
    else if (u > 1) {
      const leg = u < 2 ? leg1 : leg2, f = u < 2 ? u - 1 : u - 2;
      // Incheon: the ramp folds first, then she sails; Durrës: she comes alongside, then the ramp goes down
      const s = u < 2 ? easeIO(clamp((f - 0.1) / 0.9, 0, 1)) : easeIO(clamp(f / 0.9, 0, 1));
      ramp = u < 2 ? 1 - sm(f, 0, 0.1) : sm(f, 0.9, 1);
      leg.getPointAt(s, tan); x = tan.x; z = tan.z;
      leg.getTangentAt(Math.min(0.999, Math.max(0.001, s)), tan);
      rot = Math.atan2(tan.x, tan.z);
      if (u < 2) rot = angLerp(0, rot, sm(s, 0, 0.08));
      else rot = angLerp(rot, Math.PI, sm(s, 0.82, 1));
      moving = ramp < 0.01;
    }
    const sea2 = sm(u, 1.1, 1.4) * (1 - sm(u, 2.6, 2.9)); // out in the swell she rolls more than at the quay
    ship.position.set(x, (0.03 + 0.09 * sea2) * Math.sin(time * 1.05), z);
    ship.rotation.set(0, rot, (0.004 + 0.012 * sea2) * Math.sin(time * 1.05 + 0.6));
    ship.userData.setRamp(ramp);
    st.port.live.loadG.visible = st.port.live.moorG.visible = u < 1.001;
    st.durres.live.unloadG.visible = st.durres.live.moorG.visible = u > 2.999;
    if (shipAnchor) shipAnchor.obj.position.set(x + 2, 6, z);
    // foam for the four ships nearest the camera's subject, hers among them
    const d = [Math.sin(rot), Math.cos(rot)];
    const mine = { x, z, dir: d, len: ship.userData.len, beam: ship.userData.w, underway: moving || (u > 1.05 && u < 2.95) };
    const tx = camTarget.x, tz = camTarget.z;
    const list = [mine, ...otherShips].sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz)).slice(0, 4);
    setShips(sea, list);
  }

  // ---------- sky: both HDR skies on one dome, an overcast deck mixed over them ----------
  const bgDay = scene.background;
  scene.background = null;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({
    vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { tDay: { value: bgDay }, tGold: { value: bgDay }, uMix: { value: 0 }, uOver: { value: 0 }, uRotDay: { value: w.turn }, uRotGold: { value: w.turn }, uIntDay: { value: 0.8 / w.sky.horizonLum }, uIntGold: { value: 0.8 / w.sky.horizonLum } },
  }));
  dome.frustumCulled = false; dome.renderOrder = -1000; dome.castShadow = dome.receiveShadow = false;
  scene.add(dome);
  const hazeDay = w.sky.horizon.clone().multiplyScalar((0.8 / w.sky.horizonLum) * 0.8);
  let hazeGold = hazeDay.clone(), envDay = scene.environment, envGold = null, turnGold = w.turn;
  const daySun = new THREE.Vector3(...day.sun).normalize(), goldSun = new THREE.Vector3(...gold.sun).normalize();
  const daySunC = new THREE.Color(day.sunColor), goldSunC = new THREE.Color(gold.sunColor);
  const dayHemi = [new THREE.Color(day.hemi[0]), new THREE.Color(day.hemi[1]), day.hemi[2]], goldHemi = [new THREE.Color(gold.hemi[0]), new THREE.Color(gold.hemi[1]), gold.hemi[2]];
  // the golden sky arrives after the first view is up (only Tirana needs it)
  const goldReady = (async () => {
    const hdr = await new RGBELoader().loadAsync(skyGold);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const info = w.prepareSky(hdr);
    turnGold = info.sunAz - Math.atan2(goldSun.z, goldSun.x);
    envGold = w.pmrem.fromEquirectangular(hdr).texture;
    const U = dome.material.uniforms;
    U.tGold.value = hdr; U.uRotGold.value = turnGold; U.uIntGold.value = 0.8 / info.horizonLum;
    hazeGold = info.horizon.clone().multiplyScalar((0.8 / info.horizonLum) * 0.8);
  })().catch((e) => console.warn('golden sky', e));

  const rain = makeRain(tier === 'low' ? 900 : 1600);
  camera.add(rain); scene.add(camera);

  // ---------- one frame ----------
  const camTarget = new THREE.Vector3(), grey = new THREE.Color(), tmpC = new THREE.Color();
  let lastU = -1;
  function frame(u, time) {
    u = clamp(u, 0, 4);
    const W = weatherAt(u);
    const g = envGold ? W.gold : 0; // until the golden sky is in, Tirana keeps the day light
    // light: the sun swings low and warm toward Tirana, dims under the squall
    sunDir.copy(daySun).lerp(goldSun, g).normalize();
    sun.color.copy(daySunC).lerp(goldSunC, g);
    sun.intensity = W.sunI;
    hemi.color.copy(dayHemi[0]).lerp(goldHemi[0], g); hemi.groundColor.copy(dayHemi[1]).lerp(goldHemi[1], g);
    hemi.intensity = lerp(dayHemi[2], goldHemi[2], g) * (1 + 0.5 * W.over);
    const useGold = g > 0.5;
    scene.environment = useGold ? envGold : envDay;
    scene.environmentRotation.set(0, useGold ? turnGold : w.turn, 0);
    scene.environmentIntensity = W.env;
    voyage(u, time); // first: the camera follows her across the sea
    // the camera between the stops
    const k = Math.min(3, Math.floor(u)), f = u - k;
    const p = f < 1e-5 ? w.poses[k] : interpPose(w.poses[k], w.poses[k + 1], f, false);
    // across the sea the camera keeps her in frame: its target leans toward the ship mid-flight
    if ((k === 1 || k === 2) && f > 0) {
      const hold = Math.sin(Math.PI * f) * 0.85, sp = ship.position;
      p.t = [lerp(p.t[0], sp.x, hold), lerp(p.t[1], 2.5, hold), lerp(p.t[2], sp.z, hold)];
    }
    camTarget.set(...p.t);
    w.applyPose(p);
    scene.fog.near /= W.fogK; scene.fog.far /= W.fogK;
    const lod = LOD_D[tier] ?? 50, cp = camera.position;
    lodU.uCamPos.value.copy(cp); lodU.uLodD.value = lod;
    for (const t of treeTiles) { const on = Math.hypot(t.x - cp.x, t.z - cp.z) < lod + 36; for (const m of t.meshes) m.visible = on; }
    grey.setScalar(0.62 * (0.2126 * hazeDay.r + 0.7152 * hazeDay.g + 0.0722 * hazeDay.b));
    scene.fog.color.copy(hazeDay).lerp(hazeGold, g).lerp(tmpC.copy(grey).multiply({ r: 0.95, g: 0.98, b: 1.02 }), W.over);
    // a flash in the squall now and then (two flickers, every 8.5 s)
    const lt = time % 8.5, flash = W.rain > 0.5 ? (lt < 0.09 ? 1 : lt > 0.18 && lt < 0.24 ? 0.6 : 0) * W.rain : 0;
    renderer.toneMappingExposure = W.expo * (1 + 0.9 * flash);
    cloudU.uCloudK.value = W.clouds;
    cloudU.uCloudPhase.value = time / PERIOD; // live clouds drift on (world.js CLOUD_LIVE)
    grade.uniforms.uSat.value = W.sat;
    grade.uniforms.uTone.value = lerp(1, 2.3, g);
    sea.userData.uniforms.uPhase.value = (time % PERIOD) / PERIOD;
    sea.userData.uniforms.uChop.value = W.chop;
    const U = dome.material.uniforms; U.uMix.value = g; U.uOver.value = W.over;
    dome.position.copy(camera.position); dome.scale.setScalar(camera.far * 0.9); dome.updateMatrixWorld();
    rain.visible = W.rain > 0.01;
    rain.material.uniforms.uRain.value = W.rain; rain.material.uniforms.uTime.value = time;
    const ty = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); rain.material.uniforms.uTan.value.set(ty * camera.aspect, ty);
    const t1 = performance.now();
    // a stop out of view is skipped whole (thousands of objects the renderer would otherwise walk and test)
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    w.stations.forEach((s, i) => { s.group.visible = frustum.intersectsSphere(bounds[i]); });
    // only the stops in view keep working (their loops are cheap, but there are hundreds of movers)
    const tau = time % PERIOD;
    w.stations.forEach((s, i) => { if (Math.abs(u - i) < 1.35) s.update(tau); });
    const t2 = performance.now();
    scene.updateMatrixWorld();
    const t3 = performance.now();
    // the low tier redraws its shadow map every other frame
    frameNo++;
    w.render({ shadows: SHADOW_EVERY[tier] === 1 || frameNo % SHADOW_EVERY[tier] === 0 || Math.abs(u - lastU) > 0.004 });
    const t4 = performance.now();
    split.update = t2 - t1; split.matrices = t3 - t2; split.render = t4 - t3;
    lastU = u;
  }
  let frameNo = 0;
  const split = {};
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
  const bounds = w.stations.map((s) => { const b = new THREE.Box3().setFromObject(s.group).getBoundingSphere(new THREE.Sphere()); b.radius += 8; return b; });
  const anchorIds = w.stations.flatMap((s) => s.anchors.map((a) => a.id));
  // everything compiled up front, for the composer's target (no tone mapping there): no program compiles mid-scroll
  // (compiled before the first frame: drawn first, every program would compile there, blocking the page for seconds)
  // (one compileAsync: batching it by visibility does not work here, three's compile() walks every material each call,
  // and 40 batches took twice as long; the preloader's bar carries a compositor sheen through the wait instead)
  async function warm() {
    const vis = [];
    scene.traverse((o) => { if (!o.visible) { vis.push(o); o.visible = true; } });
    rain.visible = true;
    onProgress('compile', 0);
    renderer.setRenderTarget(w.composer.readBuffer);
    await renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(null);
    onProgress('compile', 1);
    vis.forEach((o) => { o.visible = false; });
    frame(0, 0);
    // the land, the sea, the trees and the towns never move: freeze their matrices (the stops keep theirs live)
    const live = new Set([...w.stations.map((s) => s.group), camera, dome, ship, sun, sun.target]);
    for (const c of scene.children) if (!live.has(c)) c.traverse((o) => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  }
  return {
    frame, warm, goldReady, anchors: (ids) => w.anchorsNow(ids), anchorIds, resize: (a, b, c) => w.resize(a, b, c),
    renderer, world: w, setReflection: w.reflectionOn, get u() { return lastU; },
    split,
    info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs.length, tex: renderer.info.memory.textures, geo: renderer.info.memory.geometries }),
  };
}
