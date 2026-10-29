// Small HTTP helpers shared by the functions.
export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

export const fail = (status, code, extra = {}) => json({ ok: false, error: code, ...extra }, status);

// Browsers send Sec-Fetch-Site on every request; anything not from this site's own pages is refused.
// (Origin can read "null" under a no-referrer policy, so it is only the fallback.)
export function sameOrigin(req) {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
}

// JSON body with a size cap; null when missing, too large or not JSON
export async function readJson(req, max = 16_000) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) return null;
  const text = await req.text();
  if (!text || text.length > max) return null;
  try { return JSON.parse(text); } catch { return null; }
}
