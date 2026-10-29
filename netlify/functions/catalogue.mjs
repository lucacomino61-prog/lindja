// GET /api/catalogue — the cars and the contact/showroom details the site shows (public).
import { json } from '../lib/http.mjs';
import { readCars, readSite } from '../lib/store.mjs';

export default async () => {
  const [cars, site] = await Promise.all([readCars(), readSite()]);
  return json({ ok: true, cars, site }, 200, { 'cache-control': 'public, max-age=0, must-revalidate' });
};

export const config = { path: '/api/catalogue', method: 'GET' };
