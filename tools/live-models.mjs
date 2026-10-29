// Light copies of the heaviest models for the live page (public/models/live): simplified to a triangle budget,
// textures resized, meshopt-compressed. The film keeps the full ones in public/models/sketchfab.
// usage: node tools/live-models.mjs [name ...]
import { mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, weld, simplify, textureCompress, prune, dedup, meshopt, flatten, join as joinMeshes } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public/models/sketchfab'), out = join(root, 'public/models/live');
mkdirSync(out, { recursive: true });
await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const tris = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((t, p) => t + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

// name: [triangle budget, texture size]; tiny on screen, so the budgets are low
// (the tug and the container ship are many loose parts: they need a looser error bound to reach the budget)
const JOBS = { tugboat: [14000, 256, 0.3], 'ship-container': [30000, 1024, 0.15], 'trailer-cars': [9000, 512], 'container-open': [4000, 512], 'tree-cypress-lo': [3500, 512], forklift: [2500, 256], worker: [0, 256] };
// the parked rows: ~800-triangle cars from the light copies (a car there is 20–30 px long), flat-coloured like the tug
for (const c of ['sedan', 'hatch', 'suv', 'ev']) JOBS[`car-${c}-xlo`] = [800, 64, 0.2, `car-${c}-lo`];
const FLAT = (name) => name === 'tugboat' || name.endsWith('-xlo');
const only = process.argv.slice(2);
for (const [name, [target, tex, error = 0.03, from = name]] of Object.entries(JOBS)) {
  if (only.length && !only.includes(name)) continue;
  const doc = await io.read(join(src, `${from}.glb`));
  const before = tris(doc);
  await doc.transform(dequantize());
  // the tug is a few dozen pixels on screen: each texture becomes its average colour, so its UV seams stop blocking the
  // simplifier (it cannot collapse across a seam, and halts at half the triangles)
  if (FLAT(name)) for (const m of doc.getRoot().listMaterials()) {
    const t = m.getBaseColorTexture();
    if (!t) continue;
    const { channels } = await sharp(Buffer.from(t.getImage())).stats();
    const f = m.getBaseColorFactor(), lin = (c) => Math.pow(c / 255, 2.2);
    m.setBaseColorFactor([f[0] * lin(channels[0].mean), f[1] * lin(channels[1].mean), f[2] * lin(channels[2].mean), f[3]]);
    m.setBaseColorTexture(null); m.setNormalTexture(null); m.setMetallicRoughnessTexture(null);
  }
  if (FLAT(name)) for (const p of doc.getRoot().listMeshes().flatMap((mm) => mm.listPrimitives())) p.getAttribute('TEXCOORD_0') && p.setAttribute('TEXCOORD_0', null);
  if (target && before > target) {
    if (name !== 'worker') await doc.transform(flatten(), joinMeshes());
    // drop normals so welding can merge split vertices (three.js recomputes smooth ones), keep the UVs
    for (const p of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) for (const a of ['NORMAL', 'TANGENT', 'TEXCOORD_1']) p.getAttribute(a) && p.setAttribute(a, null);
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: target / before, error }));
  }
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 80 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const dst = join(out, `${name}.glb`);
  await io.write(dst, doc);
  console.log(`${name.padEnd(18)} ${String(Math.round(before)).padStart(7)} → ${String(Math.round(tris(doc))).padStart(7)} tris  ${(statSync(join(src, `${from}.glb`)).size / 1e6).toFixed(2)} → ${(statSync(dst).size / 1e6).toFixed(2)} MB`);
}
