// Poly Haven PBR texture sets (CC0) for the offline render: colour, normal (GL) and roughness maps.
import * as THREE from 'three';
const loader = new THREE.TextureLoader();
const cache = new Map();
export function pbr(name, normalScale = 1, repeat = [1, 1]) {
  const key = name + repeat.join('x');
  if (cache.has(key)) return cache.get(key);
  const tex = (m, srgb) => { const t = loader.load(`/world/assets/polyhaven/${name}_${m}_1k.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const mat = new THREE.MeshStandardMaterial({ map: tex('diff', true), normalMap: tex('nor_gl'), roughnessMap: tex('rough'), normalScale: new THREE.Vector2(normalScale, normalScale), side: THREE.DoubleSide });
  cache.set(key, mat);
  return mat;
}
