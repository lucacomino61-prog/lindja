// Summarise GLB files: bounding box, triangles, and triangles per material (with colour and texture flags).
// usage: node tools/glb-summary.mjs file.glb ...
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() || root.listScenes()[0];
  const b = getBounds(scene);
  const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(2));
  const per = new Map();
  let tris = 0;
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const n = (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    tris += n;
    const m = p.getMaterial();
    const k = m ? m.getName() || '(unnamed)' : '(none)';
    const e = per.get(k) || { n: 0, m };
    e.n += n; per.set(k, e);
  }
  console.log(`\n== ${f.split(/[\\/]/).pop()}  size ${size.join(' x ')}  min ${b.min.map((v) => +v.toFixed(2)).join(',')}  ${Math.round(tris)} tris  ${root.listTextures().length} textures (${root.listTextures().map((t) => t.getSize()?.join('x')).join(' ')})`);
  for (const [k, { n, m }] of [...per].sort((a, b) => b[1].n - a[1].n)) {
    const c = m ? m.getBaseColorFactor().map((v) => Math.round(v * 255)) : [];
    const flags = m ? [m.getBaseColorTexture() && 'tex', m.getNormalTexture() && 'nor', m.getAlphaMode() !== 'OPAQUE' && m.getAlphaMode(), `met${m.getMetallicFactor().toFixed(1)}`, `rgh${m.getRoughnessFactor().toFixed(1)}`].filter(Boolean).join(' ') : '';
    console.log(`  ${String(Math.round(n)).padStart(7)}  ${k.slice(0, 40).padEnd(40)} rgba(${c.join(',')}) ${flags}`);
  }
}
