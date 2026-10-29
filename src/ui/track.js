// Consent and anonymous counting. Until the visitor accepts, nothing is sent and nothing about the visit is stored:
// the UTM parameters of the arrival link wait in memory. After "yes": one "view" per page, clicks on the main
// buttons ([data-track]), form starts/sends/errors (the lindja:track events from forms.js) and searches, all as
// daily totals on the server (netlify/functions/events.mjs). A browser sending Global Privacy Control counts as "no".
const KEY = 'lindja-consent', UTM = 'lindja-utm';
const read = (store, k) => { try { return store.getItem(k); } catch { return null; } };
const write = (store, k, v) => { try { v == null ? store.removeItem(k) : store.setItem(k, v); } catch {} };

export function initTracking(app = {}) {
  const lang = document.documentElement.lang;
  const box = document.getElementById('consent');
  const status = document.getElementById('consent-status');
  const q = new URLSearchParams(location.search);
  let utm = q.get('utm_source') ? { source: q.get('utm_source'), medium: q.get('utm_medium') || '', campaign: q.get('utm_campaign') || '' } : null;
  const referrer = (() => { try { const r = new URL(document.referrer); return r.origin === location.origin ? '' : r.hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const gpc = navigator.globalPrivacyControl === true;
  const on = () => !gpc && read(localStorage, KEY) === 'yes';

  const send = (type, extra = {}) => {
    if (!on()) return;
    fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, lang, ...extra }), keepalive: true }).catch(() => {});
  };
  let viewed = false;
  const start = () => {
    if (viewed) return;
    viewed = true;
    if (utm) write(sessionStorage, UTM, JSON.stringify(utm)); // the campaign lasts the visit
    else { try { utm = JSON.parse(read(sessionStorage, UTM) || 'null'); } catch { utm = null; } }
    send('view', { utm, referrer: utm ? '' : referrer });
  };
  app.getUtm = () => (on() ? utm : null); // forms.js attaches it to a booking
  app.track = send;
  document.addEventListener('click', (e) => { const el = e.target.closest('[data-track]'); if (el) send('cta', { id: el.dataset.track }); });
  document.addEventListener('lindja:track', (e) => send(e.detail.type, e.detail));

  // ---------- the banner: two equal choices, no pre-ticked box, reachable again from the footer ----------
  if (!box) return;
  const show = (focus) => { box.hidden = false; if (focus) box.querySelector('[data-consent="yes"]').focus(); };
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-consent]');
    if (!b) return;
    const v = b.dataset.consent;
    write(localStorage, KEY, v);
    if (v === 'no') write(sessionStorage, UTM, null);
    box.hidden = true;
    if (status) status.textContent = status.dataset[v];
    if (v === 'yes') start();
  });
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') box.hidden = true; }); // decide later
  document.querySelectorAll('[data-consent-open]').forEach((b) => b.addEventListener('click', () => show(true)));
  if (on()) start();
  else if (read(localStorage, KEY) == null && !gpc) {
    // on the home page, after the loader has lifted; elsewhere at once
    const loader = document.querySelector('.loader');
    if (!loader || loader.classList.contains('is-done')) show(false);
    else new MutationObserver((_, mo) => { if (loader.classList.contains('is-done')) { mo.disconnect(); setTimeout(() => show(false), 900); } }).observe(loader, { attributes: true, attributeFilter: ['class'] });
  }
}
