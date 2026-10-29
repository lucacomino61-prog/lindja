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
  return all.filter((r) => !old.includes(r)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export const getRequest = (id) => store().get(`requests/${id}`, { type: 'json' });
export const putRequest = (r) => store().setJSON(`requests/${r.id}`, r);
export const deleteRequest = (id) => store().delete(`requests/${id}`);

// ---------- counters (best effort: Blobs has no atomic increment, which is fine for a rate limit) ----------
export async function bump(key, ttlMs) {
  const s = store();
  const now = Date.now();
  const cur = await s.get(key, { type: 'json' });
  const next = cur && cur.until > now ? { n: cur.n + 1, until: cur.until } : { n: 1, until: now + ttlMs };
  await s.setJSON(key, next);
  return next.n;
}
export async function peek(key) {
  const cur = await store().get(key, { type: 'json' });
  return cur && cur.until > Date.now() ? cur.n : 0;
}
export const clear = (key) => store().delete(key);
