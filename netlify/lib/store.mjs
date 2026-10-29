// Everything the site and the admin share lives in one Netlify Blobs store:
//   cars          the catalogue (seeded from src/content/cars.js the first time it is read)
//   site          contact details and showroom addresses/hours (empty = the site keeps its default copy)
//   requests/...  one blob per test-drive booking or order request
//   rl/... auth/... counters for rate limits
import { getStore } from '@netlify/blobs';
import seedCars from '../../src/content/cars.js';

export const RETENTION_DAYS = 30;
const store = () => getStore({ name: 'lindja', consistency: 'strong' });

export const SEED_SITE = {
  contact: { address: '', phone: '', email: '' },
  showrooms: { tirana: { address: '', hours: '' }, durres: { address: '', hours: '' } },
};

export async function readCars() {
  const s = store();
  const cars = await s.get('cars', { type: 'json' });
  if (Array.isArray(cars)) return cars;
  await s.setJSON('cars', seedCars);
  return seedCars;
}
export const writeCars = (cars) => store().setJSON('cars', cars);

export async function readSite() {
  const site = await store().get('site', { type: 'json' });
  return site ? { contact: { ...SEED_SITE.contact, ...site.contact }, showrooms: { tirana: { ...SEED_SITE.showrooms.tirana, ...site.showrooms?.tirana }, durres: { ...SEED_SITE.showrooms.durres, ...site.showrooms?.durres } } } : structuredClone(SEED_SITE);
}
export const writeSite = (site) => store().setJSON('site', site);

// ---------- requests ----------
export async function addRequest(entry) {
  const id = `${new Date(entry.createdAt).toISOString().replace(/[-:.TZ]/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
  await store().setJSON(`requests/${id}`, { ...entry, id });
  return id;
}
export async function listRequests() {
  const s = store();
  const { blobs } = await s.list({ prefix: 'requests/' });
  const all = (await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' })))).filter(Boolean);
  // personal data is kept for the prototype's demo only: older than the retention window goes
  const cutoff = Date.now() - RETENTION_DAYS * 864e5;
  const old = all.filter((r) => Date.parse(r.createdAt) < cutoff);
  await Promise.all(old.map((r) => s.delete(`requests/${r.id}`)));
  await Promise.all(COUNTERS.map(([family, ttl]) => purgeCounters(family, ttl))).catch(() => {}); // old visitor hashes too
  return all.filter((r) => !old.includes(r)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export const getRequest = (id) => store().get(`requests/${id}`, { type: 'json' });
export const putRequest = (r) => store().setJSON(`requests/${r.id}`, r);
export const deleteRequest = (id) => store().delete(`requests/${id}`);

// ---------- visit counting: one blob of daily totals per day, no identifiers ----------
// Two events can arrive at once: write only if nobody changed the day since it was read (etag), else read again.
export const STATS_DAYS_KEPT = 400;
const emptyDay = () => ({ views: { sq: 0, en: 0 }, sources: {}, cta: {}, forms: { drive: { start: 0, ok: 0, error: 0 }, order: { start: 0, ok: 0, error: 0 } }, search: { hit: 0, miss: 0 } });
export async function bumpStats(day, apply) {
  const s = store(), key = `stats/${day}`;
  for (let i = 0; i < 8; i++) {
    const cur = await s.getWithMetadata(key, { type: 'json' });
    const data = cur?.data || emptyDay();
    apply(data);
    const res = cur ? await s.setJSON(key, data, { onlyIfMatch: cur.etag }) : await s.setJSON(key, data, { onlyIfNew: true });
    if (res?.modified !== false) return true;
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 60));
  }
  return false;
}
export async function readStats(days) {
  const s = store();
  const { blobs } = await s.list({ prefix: 'stats/' });
  const day = (k) => k.slice(6);
  const keep = new Date(Date.now() - STATS_DAYS_KEPT * 864e5).toISOString().slice(0, 10);
  await Promise.all(blobs.filter((b) => day(b.key) < keep).map((b) => s.delete(b.key)));
  const from = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const wanted = blobs.filter((b) => day(b.key) >= from).sort((a, b) => a.key.localeCompare(b.key));
  return Promise.all(wanted.map(async (b) => ({ day: day(b.key), ...(await s.get(b.key, { type: 'json' })) })));
}

// ---------- counters (best effort: Blobs has no atomic increment, which is fine for a rate limit) ----------
// One blob per visitor hash per time bucket (`rl/<hash>/<bucket>`), and buckets older than the last one are deleted,
// so the hashed IP really is gone after about an hour (the privacy policy says so).
const bucketKey = (base, ttlMs) => `${base}/${Math.floor(Date.now() / ttlMs)}`;
export async function bump(base, ttlMs) {
  const s = store(), key = bucketKey(base, ttlMs);
  const n = ((await s.get(key, { type: 'json' }))?.n || 0) + 1;
  await s.setJSON(key, { n });
  if (Math.random() < 0.05) purgeCounters(base.split('/')[0], ttlMs).catch(() => {});
  return n;
}
export const peek = async (base, ttlMs) => (await store().get(bucketKey(base, ttlMs), { type: 'json' }))?.n || 0;
export const clear = (base, ttlMs) => store().delete(bucketKey(base, ttlMs));
export async function purgeCounters(family, ttlMs) {
  const s = store(), now = Math.floor(Date.now() / ttlMs);
  const { blobs } = await s.list({ prefix: `${family}/` });
  await Promise.all(blobs.filter((b) => !(+b.key.split('/').pop() >= now - 1)).map((b) => s.delete(b.key)));
}
export const COUNTERS = [['rl', 3600_000], ['rle', 3600_000], ['auth', 15 * 60_000]];
