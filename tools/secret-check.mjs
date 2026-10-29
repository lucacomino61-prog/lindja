// Before a commit: no secret file staged, and no secret value (Sketchfab token, admin password, session secret) in what
// is staged. Reads the values from the local, git-ignored files and prints only where a hit is, never the value.
// usage: node tools/secret-check.mjs   (exit 1 on any hit)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => execFileSync('git', a, { cwd: root, maxBuffer: 1 << 30 });
// value → where it came from (a key name or a file line number: printed on a hit, the value never is)
const values = new Map();
// plain words and paths (letters, . / : _ -) are notes, not secrets: generated secrets carry digits or symbols
// (quotes and brackets round a note's placeholder, "<password>", come off first)
// (and every secret here is long: 16+ characters keeps dates and short notes out)
const add = (v, from, min = 16) => { v = v?.replace(/^["'`(<[]+|["'`)>\].,;:]+$/g, ''); if (v && v.length >= min && !/^[a-z./:_-]+$/i.test(v) && !values.has(v)) values.set(v, from); };
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'\s]+)/);
    if (m) add(m[2], `${f} ${m[1]}`);
    // the local dev password: the last word of .env's comment line about it (shorter, but always with a digit)
    if (/^\s*#.*(password|fjalëkalim)/i.test(line)) { const last = line.trim().split(/\s+/).pop(); if (/\d/.test(last)) add(last, `${f} line ${i + 1} (comment)`, 10); }
  });
}
const pw = path.join(root, 'ADMIN-PASSWORD.local.txt');
if (fs.existsSync(pw)) fs.readFileSync(pw, 'utf8').split(/\r?\n/).forEach((line, i) => { for (const t of line.split(/\s+/)) if (t.length >= 10) add(t, `ADMIN-PASSWORD.local.txt line ${i + 1}`); });

const staged = git('diff', '--cached', '--name-only').toString().split('\n').filter(Boolean);
const banned = staged.filter((f) => /(^|\/)(\.env(\..*)?|ADMIN-PASSWORD.*|\.netlify\/.*)$/.test(f));
let hits = 0;
for (const f of staged) {
  let buf;
  try { buf = execFileSync('git', ['show', `:${f}`], { cwd: root, maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { continue; } // deleted in the index
  const text = buf.toString('latin1');
  for (const [v, from] of values) if (text.includes(v)) { console.log(`SECRET VALUE in ${f} (the value of ${from})`); hits++; break; }
}
for (const f of banned) console.log(`SECRET FILE staged: ${f}`);
console.log(`${staged.length} staged files checked against ${values.size} secret values: ${hits + banned.length ? 'FAIL' : 'clean'}`);
process.exitCode = hits + banned.length ? 1 : 0;
