// The live page's sky and ground pictures, sized for the browser: the two Poly Haven skies halved to 1k (RGBE, run-length
// encoded) and the ground textures as WebP, into public/live. The film keeps the full ones in world/assets.
// usage: node tools/live-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'world/assets/polyhaven'), out = path.join(root, 'public/live');
fs.mkdirSync(out, { recursive: true });

// ---------- RGBE (.hdr) read / halve / write ----------
function readHdr(buf) {
  let p = 0, header = '';
  const line = () => { let s = ''; while (buf[p] !== 0x0a) s += String.fromCharCode(buf[p++]); p++; return s; };
  for (let l = line(); l !== ''; l = line()) header += l + '\n';
  const [, H, W] = line().match(/-Y (\d+) \+X (\d+)/).map(Number);
  const px = new Float32Array(W * H * 3), scan = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    if (buf[p] !== 2 || buf[p + 1] !== 2) throw new Error('flat RGBE not handled');
    p += 4;
    for (let c = 0; c < 4; c++) for (let x = 0; x < W;) {
      let n = buf[p++];
      if (n > 128) { n -= 128; const v = buf[p++]; while (n--) scan[(x++) * 4 + c] = v; } else while (n--) scan[(x++) * 4 + c] = buf[p++];
    }
    for (let x = 0; x < W; x++) {
      const e = scan[x * 4 + 3], f = e ? Math.pow(2, e - 136) : 0;
      for (let c = 0; c < 3; c++) px[(y * W + x) * 3 + c] = scan[x * 4 + c] * f;
    }
  }
  return { W, H, px, header };
}
function writeHdr(file, { W, H, px }) {
  const parts = [Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`)];
  const scan = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = px[(y * W + x) * 3], g = px[(y * W + x) * 3 + 1], b = px[(y * W + x) * 3 + 2], m = Math.max(r, g, b);
      if (m < 1e-32) { scan.set([0, 0, 0, 0], x * 4); continue; }
      const e = Math.ceil(Math.log2(m) + 1e-9), f = 256 / Math.pow(2, e);
      scan.set([Math.min(255, r * f), Math.min(255, g * f), Math.min(255, b * f), e + 128], x * 4);
    }
    const row = [2, 2, W >> 8, W & 255];
    for (let c = 0; c < 4; c++) {
      const v = (x) => scan[x * 4 + c];
      for (let x = 0; x < W;) {
        let run = 1; while (x + run < W && run < 127 && v(x + run) === v(x)) run++;
        if (run >= 3) { row.push(128 + run, v(x)); x += run; continue; }
        const s = x; let n = 0;
        while (x < W && n < 128) { let r2 = 1; while (x + r2 < W && r2 < 3 && v(x + r2) === v(x)) r2++; if (r2 >= 3) break; x++; n++; }
        row.push(n); for (let i = s; i < s + n; i++) row.push(v(i));
      }
    }
    parts.push(Buffer.from(row));
  }
  fs.writeFileSync(file, Buffer.concat(parts));
}
function halve({ W, H, px }) {
  const w = W >> 1, h = H >> 1, o = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    const at = (xx, yy) => px[(yy * W + xx) * 3 + c];
    o[(y * w + x) * 3 + c] = (at(2 * x, 2 * y) + at(2 * x + 1, 2 * y) + at(2 * x, 2 * y + 1) + at(2 * x + 1, 2 * y + 1)) / 4;
  }
  return { W: w, H: h, px: o };
}
for (const [a, b] of [['sky_2k.hdr', 'sky_1k.hdr'], ['sky_golden_2k.hdr', 'sky_golden_1k.hdr']]) {
  const img = halve(readHdr(fs.readFileSync(path.join(src, a))));
  writeHdr(path.join(out, b), img);
  console.log(b.padEnd(28), `${img.W}x${img.H}`, (fs.statSync(path.join(out, b)).size / 1e6).toFixed(2), 'MB');
}

// ---------- ground pictures ----------
const TEX = [['aerial_grass_rock_diff_2k.jpg', 'aerial_grass_rock_diff.webp', 1024]];
for (const n of ['asphalt_02', 'concrete_floor_02']) for (const [m, s] of [['diff', 1024], ['nor_gl', 512], ['rough', 512]]) TEX.push([`${n}_${m}_1k.jpg`, `${n}_${m}.webp`, s]);
for (const [a, b, size] of TEX) {
  await sharp(path.join(src, a)).resize(size, size).webp({ quality: 82 }).toFile(path.join(out, b));
  console.log(b.padEnd(28), size, (fs.statSync(path.join(out, b)).size / 1e3).toFixed(0), 'KB');
}
