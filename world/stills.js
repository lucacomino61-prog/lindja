// Cut-out stills for the page: each catalogue car, the car carrier and the car transporter, on transparent ground.
import * as THREE from 'three';
import * as V from './cars.js';
import * as P from './props.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import fontUrl from '@fontsource-variable/big-shoulders-display/files/big-shoulders-display-latin-ext-wght-normal.woff2?url';
import fontUrl2 from '@fontsource-variable/big-shoulders-display/files/big-shoulders-display-latin-wght-normal.woff2?url';

const toB64 = (blob) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(blob); });

async function subject(name) {
  const [kind, a, b] = name.split(':');
  if (kind === 'glb') { const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js'); const s = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/sketchfab/' + a + '.glb')).scene; s.rotation.y = +(b || 0); return { obj: s, dir: [0.62, 0.36, 0.78], fit: 0.7 }; } // debug: a raw model
  if (kind === 'cartop') { const c = V.car(a, b); return { obj: c, dir: [0.02, 1, 0.05], fit: 0.8 }; }
  if (kind === 'car') { const c = V.car(a, b); c.rotation.y = Math.PI - 1.5; return { obj: c, dir: [0.62, 0.36, 0.78], fit: 0.66 }; } // front three-quarter
  if (kind === 'ship') { const s = V.containerShip({ len: 34 }); s.rotation.y = -Math.PI / 2 - 0.35; return { obj: s, dir: [0.6, 0.45, 0.8], fit: 0.9 }; }
  if (kind === 'open') { const o = P.openContainer(); o.rotation.y = -0.6; return { obj: o, dir: [0.62, 0.42, 0.78], fit: 0.8 }; }
  if (kind === 'transporter') { const t = V.carTransporter(5); t.rotation.y = Math.PI / 2; return { obj: t, dir: [0.45, 0.42, 0.85], fit: 0.95 }; }
}

async function boot() {
  for (const [u, range] of [[fontUrl2, 'U+0000-00FF'], [fontUrl, 'U+0100-024F']]) document.fonts.add(await new FontFace('Big Shoulders Display', `url(${u})`, { weight: '100 900', unicodeRange: range }).load());
  await document.fonts.load('800 100px "Big Shoulders Display"', 'LINDJA lindja');
  await V.loadModels();
  const hdr = await new RGBELoader().loadAsync('/world/assets/polyhaven/sky_2k.hdr'); hdr.mapping = THREE.EquirectangularReflectionMapping;
  const canvas = document.getElementById('c');

  async function cutout(name, w = 1280, h = 840) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(w, h, false); r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromEquirectangular(hdr).texture; scene.environmentIntensity = 0.8;
    scene.add(new THREE.HemisphereLight('#D3E6F0', '#C8B48E', 1.2));
    const sun = new THREE.DirectionalLight('#FFF0DE', 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 5; sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.06;
    scene.add(sun, sun.target);
    const { obj, dir, fit } = await subject(name);
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.2 })); ground.rotation.x = -Math.PI / 2; ground.position.y = box.min.y + 0.001; ground.receiveShadow = true; scene.add(ground);
    const half = Math.max(size.x, size.z) * 0.9;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.1, far: half * 12 }); sun.shadow.camera.updateProjectionMatrix();
    sun.target.position.copy(c); sun.position.copy(c).add(new THREE.Vector3(-half * 1.4, half * 2.6, half * 1.2));
    const cam = new THREE.PerspectiveCamera(20, w / h, 0.01, 1000);
    const d = new THREE.Vector3(...dir).normalize();
    const radius = size.length() * 0.5;
    cam.position.copy(c).addScaledVector(d, (radius / Math.tan((20 * Math.PI) / 360)) * fit);
    cam.lookAt(c);
    r.render(scene, cam);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.86));
    r.dispose();
    return toB64(blob);
  }
  window.stills = { cutout };
  window.stillsReady = true;
}
boot().catch((e) => { window.stillsError = String(e && e.stack || e); console.error(e); });
