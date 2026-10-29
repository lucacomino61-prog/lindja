// Poly Haven PBR texture sets (CC0) for the offline render: colour, normal (GL) and roughness maps.
// `grey` turns the colour map to soft-contrast luminance (Poly Haven's concrete is beige and grainy; port aprons are grey).
import * as THREE from 'three';
import { groundUrl } from './quality.js';
const loader = new THREE.TextureLoader();
const cache = new Map();
function toGrey(t) {
  const img = t.image, cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, cv.width, cv.height);
  let mean = 0;
  for (let i = 0; i < d.data.length; i += 4) mean += 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
  mean /= d.data.length / 4;
  for (let i = 0; i < d.data.length; i += 4) { const l = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]; d.data[i] = d.data[i + 1] = d.data[i + 2] = mean + (l - mean) * 0.4; } // softer grain
  g.putImageData(d, 0, 0);
  t.image = cv; t.needsUpdate = true;
}
export function pbr(name, normalScale = 1, repeat = [1, 1], { grey = false } = {}) {
  const key = name + repeat.join('x') + (grey ? 'g' : '');
  if (cache.has(key)) return cache.get(key);
  const tex = (m, srgb) => {
    const t = loader.load(groundUrl(`${name}_${m}`), srgb && grey ? toGrey : undefined);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const mat = new THREE.MeshStandardMaterial({ map: tex('diff', true), normalMap: tex('nor_gl'), roughnessMap: tex('rough'), normalScale: new THREE.Vector2(normalScale, normalScale), side: THREE.DoubleSide });
  cache.set(key, mat);
  return mat;
}
