// Download the Sketchfab models listed in tools/sketchfab.json (name → model uid) as GLB.
// The API token is read from .env.local (SKETCHFAB_TOKEN=...) and never printed.
// usage: node tools/sketchfab.mjs <raw-dir> [name ...]
// Writes <raw-dir>/<name>.glb plus public/models/sketchfab/CREDITS.txt (every model is CC-BY or CC0).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const token = (readFileSync(join(root, '.env.local'), 'utf8').match(/^SKETCHFAB_TOKEN=(\w+)\s*$/m) || [])[1];
if (!token) { console.error('SKETCHFAB_TOKEN missing in .env.local'); process.exit(1); }
const list = JSON.parse(readFileSync(join(root, 'tools/sketchfab.json'), 'utf8'));
const [rawDir, ...only] = process.argv.slice(2);
if (!rawDir) { console.error('usage: node tools/sketchfab.mjs <raw-dir> [name ...]'); process.exit(1); }
mkdirSync(rawDir, { recursive: true });

async function api(path, auth) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://api.sketchfab.com/v3${path}`, auth ? { headers: { Authorization: `Token ${token}` } } : {});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { if (i === 3) throw e; await new Promise((res) => setTimeout(res, 2000)); }
  }
}
async function file(url, to) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); writeFileSync(to, Buffer.from(await r.arrayBuffer())); return; }
    catch (e) { if (i === 3) throw e; await new Promise((res) => setTimeout(res, 2000)); }
  }
}

const credits = [];
for (const [name, uid] of Object.entries(list)) {
  const m = await api(`/models/${uid}`);
  const lic = m.license?.label || '';
  if (lic !== 'CC Attribution' && !/^CC0/.test(lic)) { console.error(`${name}: licence "${lic}" is not CC-BY or CC0, skipped`); continue; }
  credits.push(`${name}: "${m.name}" by ${m.user.displayName || m.user.username} (${m.user.profileUrl || 'https://sketchfab.com/' + m.user.username}), ${lic}, ${m.viewerUrl}`);
  if (only.length && !only.includes(name)) continue;
  const to = join(rawDir, `${name}.glb`);
  if (existsSync(to)) { console.log(`${name}: already downloaded`); continue; }
  const dl = await api(`/models/${uid}/download`, true);
  if (!dl.glb?.url) { console.error(`${name}: no GLB offered (${Object.keys(dl).join(', ')})`); continue; }
  await file(dl.glb.url, to);
  console.log(`${name}: ${(dl.glb.size / 1e6).toFixed(1)} MB  "${m.name}"`);
}
const out = join(root, 'public/models/sketchfab');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'CREDITS.txt'), `Models from Sketchfab, used under their Creative Commons licences. Changes: optimised for the web (simplified copies, textures resized and compressed), cars repainted, containers recoloured, the trailer's own cars replaced.\n\n${credits.join('\n')}\n`);
console.log(`credits: ${credits.length} models`);
