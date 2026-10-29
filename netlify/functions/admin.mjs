// /api/admin/* — sign-in, the requests inbox, the catalogue and the contact details.
// Everything except login/session needs the signed session cookie; every change must come from this site.
import { json, fail, sameOrigin, readJson } from '../lib/http.mjs';
import { configured, checkPassword, sessionCookie, clearCookie, signedIn, visitor } from '../lib/auth.mjs';
import { readCars, writeCars, readSite, writeSite, listRequests, getRequest, putRequest, deleteRequest, bump, peek, clear, readStats } from '../lib/store.mjs';
import { checkCars, checkSite, REQUEST_STATES } from '../lib/validate.mjs';

const LOCK_AFTER = 8, LOCK_MS = 15 * 60_000;
const csvCell = (v) => { const s = String(v ?? ''); return /^[=+\-@\t\r]/.test(s) ? `"'${s.replace(/"/g, '""')}"` : `"${s.replace(/"/g, '""')}"`; }; // no formula injection in spreadsheets

export default async (req, context) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/admin\/?/, '').replace(/\/$/, '');
  const m = req.method;
  if (m !== 'GET' && !sameOrigin(req)) return fail(403, 'origin');

  // ---------- sign-in ----------
  if (route === 'session' && m === 'GET') return json({ ok: true, configured: configured(), signedIn: signedIn(req) });
  if (route === 'login' && m === 'POST') {
    if (!configured()) return fail(503, 'not-configured');
    const key = `auth/${visitor(context)}`;
    if ((await peek(key, LOCK_MS)) >= LOCK_AFTER) return fail(429, 'locked', { minutes: 15 });
    const body = await readJson(req, 1000);
    if (!body || !checkPassword(body.password)) {
      const n = await bump(key, LOCK_MS);
      return fail(401, 'password', { left: Math.max(0, LOCK_AFTER - n) });
    }
    await clear(key, LOCK_MS);
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie() });
  }
  if (route === 'logout' && m === 'POST') return json({ ok: true }, 200, { 'set-cookie': clearCookie() });

  if (!signedIn(req)) return fail(401, 'signin');

  // ---------- requests inbox ----------
  if (route === 'requests' && m === 'GET') return json({ ok: true, requests: await listRequests() });
  if (route === 'requests.csv' && m === 'GET') {
    const rows = await listRequests();
    const head = ['created', 'kind', 'status', 'name', 'phone', 'email', 'car / model', 'showroom', 'date', 'time', 'budget', 'year from', 'notes', 'admin note', 'source', 'medium', 'campaign'];
    const lines = rows.map((r) => [r.createdAt, r.kind, r.status, r.data.name, r.data.phone, r.data.email, r.data.carLabel || r.data.model, r.data.showroom, r.data.date, r.data.time, r.data.budget, r.data.yearFrom, r.data.notes, r.note, r.source?.source, r.source?.medium, r.source?.campaign].map(csvCell).join(','));
    return new Response('﻿' + [head.map(csvCell).join(','), ...lines].join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="lindja-requests-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } });
  }
  const one = route.match(/^requests\/([\w-]{8,60})$/);
  if (one && m === 'PATCH') {
    const r = await getRequest(one[1]);
    if (!r) return fail(404, 'missing');
    const body = await readJson(req, 4000);
    if (!body) return fail(400, 'body');
    if (body.status != null) { if (!REQUEST_STATES.includes(body.status)) return fail(422, 'status'); r.status = body.status; }
    if (body.note != null) { if (typeof body.note !== 'string' || body.note.length > 1000) return fail(422, 'note'); r.note = body.note.trim(); }
    r.updatedAt = new Date().toISOString();
    await putRequest(r);
    return json({ ok: true, request: r });
  }
  if (one && m === 'DELETE') { await deleteRequest(one[1]); return json({ ok: true }); }

  // ---------- visit counting: the daily totals of the last 7, 30 or 90 days ----------
  if (route === 'stats' && m === 'GET') {
    const days = [7, 30, 90].includes(+url.searchParams.get('days')) ? +url.searchParams.get('days') : 30;
    return json({ ok: true, days, stats: await readStats(days) });
  }

  // ---------- catalogue + contact ----------
  if (route === 'data' && m === 'GET') { const [cars, site] = await Promise.all([readCars(), readSite()]); return json({ ok: true, cars, site }); }
  if (route === 'cars' && m === 'PUT') {
    const body = await readJson(req, 64_000);
    const { errors, cars } = checkCars(body?.cars);
    if (errors.length) return fail(422, 'invalid', { cars: errors });
    await writeCars(cars);
    return json({ ok: true, cars });
  }
  if (route === 'site' && m === 'PUT') {
    const body = await readJson(req, 4000);
    const { errors, site } = checkSite(body?.site);
    if (errors.length) return fail(422, 'invalid', { fields: errors });
    await writeSite(site);
    return json({ ok: true, site });
  }
  return fail(404, 'route');
};

export const config = { path: '/api/admin/*' };
