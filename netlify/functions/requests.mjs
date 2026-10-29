// POST /api/requests — a test-drive booking or an order request from the site's forms.
// Same-origin only, 16 KB at most, a honeypot field and a minimum fill time for bots, 10 per hour per visitor.
import { json, fail, sameOrigin, readJson } from '../lib/http.mjs';
import { readCars, addRequest, bump } from '../lib/store.mjs';
import { checkRequest } from '../lib/validate.mjs';
import { visitor } from '../lib/auth.mjs';

export default async (req, context) => {
  if (!sameOrigin(req)) return fail(403, 'origin');
  const body = await readJson(req);
  if (!body) return fail(400, 'body');
  // a filled honeypot or a form sent faster than a person can type: answer as if stored, keep nothing
  if (body.website || !(Number(body.t) >= 2500)) return json({ ok: true }, 201);
  if ((await bump(`rl/${visitor(context)}`, 3600_000)) > 10) return fail(429, 'rate');
  const { errors, value } = checkRequest(body, await readCars());
  if (errors.length) return fail(422, 'invalid', { fields: errors });
  const id = await addRequest({ ...value, status: 'new', note: '', createdAt: new Date().toISOString() });
  return json({ ok: true, id }, 201);
};

export const config = { path: '/api/requests', method: 'POST' };
