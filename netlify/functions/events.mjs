// POST /api/events — anonymous visit counting, sent only after the visitor accepts it (src/ui/analytics.js).
// Adds one to a daily total; keeps no IP, no identifier, no cookie. Same-origin, small, 300 per hour per visitor.
import { json, fail, sameOrigin, readJson } from '../lib/http.mjs';
import { bumpStats, bump } from '../lib/store.mjs';
import { visitor } from '../lib/auth.mjs';
import { EVENT_TYPES, CTAS, checkSource, token } from '../lib/validate.mjs';

const MAX_SOURCES = 200; // distinct sources a day: enough for real campaigns, a ceiling for junk

export default async (req, context) => {
  if (!sameOrigin(req)) return fail(403, 'origin');
  const e = await readJson(req, 2000);
  if (!e || !EVENT_TYPES.includes(e.type)) return fail(400, 'body');
  if ((await bump(`rle/${visitor(context)}`, 3600_000)) > 300) return fail(429, 'rate');
  const lang = e.lang === 'en' ? 'en' : 'sq';
  const form = ['drive', 'order'].includes(e.form) ? e.form : null;
  if (e.type.startsWith('form_') && !form) return fail(422, 'form');
  if (e.type === 'cta' && !CTAS.includes(e.id)) return fail(422, 'cta');
  const src = checkSource(e.utm) || { source: token(e.referrer) || 'direct', medium: '', campaign: '' };
  const day = new Date().toISOString().slice(0, 10);
  const ok = await bumpStats(day, (d) => {
    if (e.type === 'view') {
      d.views[lang] += 1;
      const key = [src.source, src.medium || '-', src.campaign || '-'].join(' / ');
      if (d.sources[key] != null || Object.keys(d.sources).length < MAX_SOURCES) d.sources[key] = (d.sources[key] || 0) + 1;
    } else if (e.type === 'cta') d.cta[e.id] = (d.cta[e.id] || 0) + 1;
    else if (e.type === 'search') d.search[e.hit ? 'hit' : 'miss'] += 1;
    else d.forms[form][e.type.slice(5)] += 1;
  });
  return ok ? json({ ok: true }, 202) : fail(503, 'busy');
};

export const config = { path: '/api/events', method: 'POST' };
