// Tree impostors for the live page. Each kind's light model is drawn once at load, from the side and from above, into
// a small atlas; far trees become two crossed cards and a canopy card (6 triangles instead of thousands), one draw call
// per kind. Near the camera the light models stand instead. Both cut by distance in the vertex shader, against the same
// uniforms, so every tree is drawn exactly once: the card inside uLodD collapses, the model outside it.
import * as THREE from 'three';

export const lodU = { uCamPos: { value: new THREE.Vector3() }, uLodD: { value: 70 } };
export function lodCut(mat, keepNear) {
  if (mat.userData.lodCut) return mat;
  mat.userData.lodCut = true;
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    Object.assign(sh.uniforms, lodU);
    if (sh.vertexShader.includes('uniform vec3 uCamPos;')) return; // already cut (a material shared by two parts)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uCamPos; uniform float uLodD;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        { float dc = distance((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz, uCamPos);
          if (${keepNear ? 'dc > uLodD' : 'dc < uLodD'}) transformed = vec3(0.0); }
        #endif`);
  };
  mat.customProgramCacheKey = () => key + (keepNear ? '|lodNear' : '|lodFar');
  return mat;
}

const RES = 256;
export function bakeTreeImpostors(renderer, trees) {
  const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  for (const [kind, t] of Object.entries(trees)) {
    const parts = t.far;
    const box = new THREE.Box3();
    for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
    const h = box.max.y, hw = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) * 1.02;
    const scene = new THREE.Scene();
    for (const p of parts) scene.add(new THREE.Mesh(p.geo, new THREE.MeshBasicMaterial({ map: p.material.map, color: p.material.color, alphaTest: p.leaf ? 0.45 : 0, side: THREE.DoubleSide })));
    const rt = new THREE.WebGLRenderTarget(RES * 2, RES, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    const side = new THREE.OrthographicCamera(-hw, hw, h, 0, -hw * 4, hw * 4); side.position.set(0, 0, hw * 2); side.lookAt(0, 0, 0);
    const top = new THREE.OrthographicCamera(-hw, hw, hw, -hw, 0.01, h * 4); top.position.set(0, h * 2, 0); top.up.set(0, 0, -1); top.lookAt(0, 0, 0);
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x2b3820, 0); renderer.clear(); // a leaf-dark clear: mip levels fade to green, not to black
    rt.scissorTest = true;
    rt.viewport.set(0, 0, RES, RES); rt.scissor.set(0, 0, RES, RES); renderer.setRenderTarget(rt); renderer.render(scene, side);
    rt.viewport.set(RES, 0, RES, RES); rt.scissor.set(RES, 0, RES, RES); renderer.setRenderTarget(rt); renderer.render(scene, top);
    rt.scissorTest = false; rt.viewport.set(0, 0, RES * 2, RES); rt.scissor.set(0, 0, RES * 2, RES);
    scene.traverse((o) => o.material?.dispose());
    // the cards: two crossed vertical quads (side view) and one canopy quad at 55 % of the height (top view)
    const pos = [], uv = [], nrm = [], idx = [];
    const quad = (pts, uvs) => { const b = pos.length / 3; for (let i = 0; i < 4; i++) { const [x, y, z] = pts[i]; pos.push(x, y, z); uv.push(...uvs[i]); const n = new THREE.Vector3(x / hw, 0.75, z / hw).normalize(); nrm.push(n.x, n.y, n.z); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
    const sideUV = [[0, 0], [0.5, 0], [0.5, 1], [0, 1]];
    quad([[-hw, 0, 0], [hw, 0, 0], [hw, h, 0], [-hw, h, 0]], sideUV);
    quad([[0, 0, hw], [0, 0, -hw], [0, h, -hw], [0, h, hw]], sideUV);
    const ch = h * 0.55;
    quad([[-hw, ch, hw], [hw, ch, hw], [hw, ch, -hw], [-hw, ch, -hw]], [[0.5, 0], [1, 0], [1, 1], [0.5, 1]]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeBoundingSphere();
    const material = lodCut(new THREE.MeshStandardMaterial({ map: rt.texture, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.88, metalness: 0 }), false);
    const depth = lodCut(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: rt.texture, alphaTest: 0.42, side: THREE.DoubleSide }), false);
    t.card = { geo, material, depth, rt };
  }
  renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevClear, prevAlpha);
}
