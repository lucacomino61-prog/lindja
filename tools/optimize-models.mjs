// Turn the raw Sketchfab downloads into web-sized GLBs in public/models/sketchfab:
// spec-gloss → metal-rough (three.js reads only the latter), merge by material, WebP textures,
// and for cars a second light copy (<name>-lo.glb) simplified to about 6,000 triangles for the parked rows.
// usage: node tools/optimize-models.mjs <raw-dir> [name ...]
import { readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { metalRough, dedup, flatten, join as joinMeshes, weld, simplify, textureCompress, prune, unpartition, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/models/sketchfab');
mkdirSync(out, { recursive: true });
const [rawDir, ...only] = process.argv.slice(2);
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const tris = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((t, p) => t + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
async function build(src, dst, { tex, target }) {
  const doc = await io.read(src);
  const before = tris(doc);
  await doc.transform(metalRough(), dedup(), flatten(), joinMeshes());
  // hard-edged models split every vertex by its normal, which leaves the simplifier nothing to collapse:
  // the light copy drops normals (three.js recomputes smooth ones) and the second UV set before welding
  if (target) for (const p of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    const m = p.getMaterial(), textured = m && (m.getBaseColorTexture() || m.getNormalTexture() || m.getMetallicRoughnessTexture() || m.getEmissiveTexture());
    for (const a of ['NORMAL', 'TANGENT', 'TEXCOORD_1', 'COLOR_0', ...(textured ? [] : ['TEXCOORD_0'])]) p.getAttribute(a) && p.setAttribute(a, null);
  }
  await doc.transform(weld());
  if (target && before > target) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: target / before, error: 0.02 }));
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 82 }), unpartition(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(dst, doc);
  console.log(`${dst.split(/[\\/]/).pop().padEnd(24)} ${String(Math.round(before)).padStart(7)} → ${String(Math.round(tris(doc))).padStart(7)} tris  ${(statSync(dst).size / 1e6).toFixed(2)} MB`);
}

for (const f of readdirSync(rawDir).filter((f) => f.endsWith('.glb'))) {
  const name = f.slice(0, -4);
  if (only.length && !only.includes(name)) continue;
  const src = join(rawDir, f);
  await build(src, join(out, f), { tex: name.startsWith('ship') ? 2048 : 1024 });
  if (name.startsWith('car-')) await build(src, join(out, `${name}-lo.glb`), { tex: 256, target: 6000 });
}
