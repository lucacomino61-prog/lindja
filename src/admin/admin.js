// The LINDJA admin: sign-in, the requests inbox (test drives + orders from the site), the cars on the site and the
// contact details. Talks to /api/admin/*; the session is an HttpOnly cookie the page never sees.
// The view is in the URL (#kerkesat, #makinat, #kontakti) so a reload keeps your place.
import T from './i18n.js';
import { CAR_IMAGES } from '../content/cars.js';

const MAKES = ['Hyundai', 'Kia', 'Genesis', 'KGM'];
const FUELS = ['petrol', 'diesel', 'hybrid', 'ev'], GEARS = ['auto', 'manual'], BODIES = ['suv', 'sedan', 'hatch', 'ev'], CAR_STATES = ['new', 'used', 'korea'];
const REQ_STATES = ['new', 'contacted', 'closed'];
const ROUTES = { kerkesat: 'requests', makinat: 'cars', kontakti: 'contact', statistikat: 'stats' };
const YEAR_MAX = new Date().getFullYear() + 1;
const MONTHS_SQ = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'korr', 'gush', 'sht', 'tet', 'nën', 'dhj']; // Chrome ships no Albanian date names

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'sq' ? '.' : ',');
const euro = (n) => (lang === 'sq' ? `€ ${group(n)}` : `€${group(n)}`);
const fill = (s, v) => s.replace('{n}', v);
const i = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const icon = {
  arrow: i('<path d="M4 12h15m-6-6 6 6-6 6"/>'), chev: i('<path d="m6 9 6 6 6-6"/>'), close: i('<path d="m6 6 12 12M18 6 6 18"/>'),
  plus: i('<path d="M12 5v14M5 12h14"/>'), search: i('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'), out: i('<path d="M14 5h5v14h-5M10 8l-4 4 4 4M6 12h10"/>'),
  ext: i('<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>'), down: i('<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>'), refresh: i('<path d="M19 8a8 8 0 1 0 1 6M19 3v5h-5"/>'),
  copy: i('<rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'),
};
const wordmark = '<svg class="wordmark" viewBox="0 0 150 44" aria-hidden="true"><text x="75" y="35" text-anchor="middle">lindja</text></svg>';

let lang = (() => { try { return localStorage.getItem('lindja-admin-lang') === 'en' ? 'en' : 'sq'; } catch { return 'sq'; } })();
let t = T[lang];
const root = document.getElementById('app');
const state = { requests: [], cars: [], site: null, stats: null, statsDays: 30, loaded: { requests: false, data: false }, filter: { kind: 'all', status: 'any', q: '' }, open: new Set(), view: 'requests' };

// ---------- API ----------
class ApiError extends Error { constructor(status, data) { super(data?.error || String(status)); this.status = status; this.data = data; } }
async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api/admin/${path}`, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError(0, { error: 'network' }); }
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json().catch(() => null) : null;
  if (res.status === 401 && data?.error === 'signin') { renderLogin(t.errors.signin); throw new ApiError(401, data); }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
const failText = (e) => (e.status === 0 ? t.errors.network : t.errors.generic);

// ---------- dates ----------
function dayLabel(iso) { // "2026-11-12" → "12 nën 2026" / "12 Nov 2026"
  const [y, m, d] = iso.split('-').map(Number);
  return lang === 'sq' ? `${d} ${MONTHS_SQ[m - 1]} ${y}` : new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function stamp(iso, short = false) { // short: the list column, the year only when it isn't this year
  const d = new Date(iso), p = (n) => String(n).padStart(2, '0');
  const year = !short || d.getFullYear() !== new Date().getFullYear() ? `.${d.getFullYear()}` : '';
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}${year} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return t.ago.now;
  if (s < 3600) return t.ago.min(Math.floor(s / 60));
  if (s < 86400) return t.ago.h(Math.floor(s / 3600));
  return t.ago.d(Math.floor(s / 86400));
}

// ---------- toast + confirm ----------
// a click on a dialog's backdrop targets the dialog itself, and so does one on its padding: tell them apart by position
const outside = (d, e) => { const r = d.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
let toastTimer = 0;
function toast(msg, tone = 'ok') {
  const el = $('.toast');
  if (!el) return;
  el.textContent = msg;
  el.dataset.tone = tone;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), tone === 'error' ? 5200 : 2800);
}
function confirmBox(title, lead, action) {
  const d = $('#confirm');
  d.innerHTML = `<h2 id="confirm-h">${esc(title)}</h2><p>${esc(lead)}</p><div class="confirm__acts"><button type="button" class="btn btn--ghost-ink btn--sm" value="no">${esc(t.cars.cancel)}</button><button type="button" class="btn btn--danger btn--sm" value="yes">${esc(action)}</button></div>`;
  return new Promise((resolve) => {
    const done = (v) => { d.close(); resolve(v); };
    d.onclick = (e) => { const b = e.target.closest('button'); if (b) done(b.value === 'yes'); else if (outside(d, e)) done(false); };
    d.oncancel = () => resolve(false);
    d.showModal();
    d.querySelector('[value="no"]').focus(); // the safe choice has the focus
  });
}

// ---------- sign-in ----------
async function boot() {
  let s;
  try { s = await fetch('/api/admin/session', { credentials: 'same-origin' }).then((r) => r.json()); } catch { s = null; }
  root.removeAttribute('aria-busy');
  if (!s) return renderLogin(t.login.network);
  if (!s.configured) return renderLogin(t.login.notConfigured, true);
  if (!s.signedIn) return renderLogin();
  renderShell();
}
function renderLogin(msg = '', disabled = false) {
  document.title = `${t.login.title} · LINDJA`;
  root.innerHTML = `
  <div class="login">
    <section class="login__field" aria-hidden="true">
      <span class="login__brand">${wordmark}</span>
      <p class="login__title">${esc(t.login.title)}</p>
      <p class="login__proto mono">${esc(t.proto)}</p>
      <span class="login__mark">lindja</span>
    </section>
    <main class="login__panel" id="view">
      <form class="login__form" novalidate>
        <h1>${esc(t.login.title)} LINDJA</h1>
        <p class="login__lead">${esc(t.login.lead)}</p>
        <div class="field"><label for="pw">${esc(t.login.password)}</label>
          <div class="pw"><input id="pw" name="password" type="password" autocomplete="current-password" required ${disabled ? 'disabled' : ''}><button type="button" class="pw__toggle" aria-controls="pw" aria-pressed="false">${esc(t.login.show)}</button></div></div>
        <p class="login__msg" role="alert" ${msg ? '' : 'hidden'}>${esc(msg)}</p>
        <button type="submit" class="btn btn--ink" ${disabled ? 'disabled' : ''}>${esc(t.login.submit)} ${icon.arrow}</button>
        <a class="login__back" href="/">${esc(t.login.back)}</a>
      </form>
    </main>
  </div>`;
  const form = $('.login__form'), pw = $('#pw'), note = $('.login__msg'), btn = form.querySelector('[type=submit]');
  const say = (m) => { note.textContent = m; note.hidden = !m; };
  $('.pw__toggle').addEventListener('click', (e) => {
    const on = pw.type === 'password';
    pw.type = on ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    e.currentTarget.textContent = on ? t.login.hide : t.login.show;
    pw.focus();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pw.value) { say(t.login.empty); pw.setAttribute('aria-invalid', 'true'); pw.focus(); return; }
    btn.setAttribute('aria-busy', 'true'); btn.firstChild.nodeValue = `${t.login.sending} `;
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw.value }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { renderShell(); return; }
      say(res.status === 429 ? t.login.locked : res.status === 503 ? t.login.notConfigured : res.status === 401 ? fill(t.login.wrong, data.left ?? 0) : t.login.network);
      pw.setAttribute('aria-invalid', 'true'); pw.select();
    } catch { say(t.login.network); }
    btn.removeAttribute('aria-busy'); btn.firstChild.nodeValue = `${t.login.submit} `;
  });
  if (!disabled) pw.focus();
}

// ---------- the shell ----------
function renderShell() {
  document.documentElement.lang = lang;
  const tab = (hash, key, n = '') => `<li><a class="tab" href="#${hash}" data-view="${key}">${esc(t.nav[key])}${n}</a></li>`;
  root.innerHTML = `
  <a class="skip-link" href="#view">${esc(t.skip)}</a>
  <header class="bar">
    <a class="bar__brand" href="#kerkesat" aria-label="LINDJA — ${esc(t.nav.requests)}">${wordmark}<span>${esc(T[lang].login.title)}</span></a>
    <nav aria-label="${esc(t.nav.label)}"><ul class="tabs">${tab('kerkesat', 'requests', '<span class="tab__n" aria-hidden="true"></span>')}${tab('makinat', 'cars')}${tab('kontakti', 'contact')}${tab('statistikat', 'stats')}</ul></nav>
    <div class="bar__tools">
      <div role="group" aria-label="${esc(t.nav.lang)}" style="display:flex"><button type="button" data-lang="sq" aria-pressed="${lang === 'sq'}">SQ</button><button type="button" data-lang="en" aria-pressed="${lang === 'en'}">EN</button></div>
      <a href="/${lang === 'en' ? 'en/' : ''}" target="_blank" rel="noopener">${icon.ext}<span class="lbl">${esc(t.nav.site)}</span></a>
      <button type="button" data-act="signout">${icon.out}<span class="lbl">${esc(t.nav.out)}</span></button>
    </div>
  </header>
  <main class="view" id="view" tabindex="-1"></main>
  <dialog class="confirm" id="confirm" aria-labelledby="confirm-h"></dialog>
  <dialog class="drawer" id="drawer" aria-labelledby="drawer-h"></dialog>
  <div class="toast" role="status" aria-live="polite"></div>`;
  $('.bar').addEventListener('click', async (e) => {
    const l = e.target.closest('[data-lang]');
    if (l && l.dataset.lang !== lang) { lang = l.dataset.lang; t = T[lang]; try { localStorage.setItem('lindja-admin-lang', lang); } catch {} renderShell(); return; }
    if (e.target.closest('[data-act="signout"]')) {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
      state.loaded = { requests: false, data: false };
      renderLogin();
    }
  });
  const view = $('#view');
  view.addEventListener('click', onClick);
  view.addEventListener('change', onChange);
  view.addEventListener('input', onInput);
  view.addEventListener('submit', onSubmit);
  view.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.act === 'car-price') e.target.blur(); }); // Enter commits a price like a form would
  $('#drawer').addEventListener('click', onDrawerClick);
  $('#drawer').addEventListener('submit', onDrawerSubmit);
  route(false);
  loadAll();
}
addEventListener('hashchange', () => { if ($('#view.view')) route(true); });
function route(focus) {
  state.view = ROUTES[location.hash.slice(1)] || 'requests';
  $$('.tab').forEach((a) => (a.dataset.view === state.view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.title = `${t.nav[state.view]} · ${t.login.title} LINDJA`;
  draw();
  if (state.view === 'stats') loadStats();
  if (focus) $('#view').focus({ preventScroll: true });
}
async function loadStats() {
  try { state.stats = (await api(`stats?days=${state.statsDays}`)).stats; } catch (e) { if (e.status !== 401) toast(failText(e), 'error'); state.stats = state.stats || []; }
  if (state.view === 'stats') draw();
}
async function loadAll() {
  const [r, d] = await Promise.allSettled([api('requests'), api('data')]);
  if (r.status === 'fulfilled') { state.requests = r.value.requests; state.loaded.requests = true; }
  if (d.status === 'fulfilled') { state.cars = d.value.cars; state.site = d.value.site; state.loaded.data = true; }
  if (r.status === 'rejected' && r.reason.status !== 401) toast(failText(r.reason), 'error');
  if ($('#view.view')) draw();
}
async function reloadRequests() {
  try { state.requests = (await api('requests')).requests; state.loaded.requests = true; draw(); } catch (e) { if (e.status !== 401) toast(failText(e), 'error'); }
}
document.addEventListener('visibilitychange', () => {
  // back on the tab: fetch new requests, unless something is being typed in the view
  if (document.visibilityState === 'visible' && state.view === 'requests' && $('#view.view') && !$('#view').contains(document.activeElement)) reloadRequests();
});

function draw() {
  const view = $('#view');
  if (!view) return;
  const n = state.requests.filter((r) => r.status === 'new').length;
  const badge = $('.tab__n');
  if (badge) badge.textContent = n ? String(n) : '';
  view.innerHTML = state.view === 'cars' ? viewCars() : state.view === 'contact' ? viewContact() : state.view === 'stats' ? viewStats() : viewRequests();
}

// ---------- stats: the daily totals, added up over the period ----------
function viewStats() {
  const S = t.stats;
  const period = `<label class="period"><span>${esc(S.period)}</span><select data-act="stats-days">${[7, 30, 90].map((d) => `<option value="${d}"${d === state.statsDays ? ' selected' : ''}>${esc(S.days(d))}</option>`).join('')}</select></label>`;
  if (!state.stats) return head(S.h, S.lead, period) + '<div aria-hidden="true">' + '<div class="sk"></div>'.repeat(4) + '</div>';
  const days = state.stats;
  const sum = (f) => days.reduce((n, d) => n + (f(d) || 0), 0);
  const views = { sq: sum((d) => d.views?.sq), en: sum((d) => d.views?.en) };
  const total = views.sq + views.en;
  if (!total && !days.length) return head(S.h, S.lead, period) + `<div class="empty"><p>${esc(S.empty)}</p></div>`;
  const add = (key) => days.reduce((m, d) => { for (const [k, v] of Object.entries(d[key] || {})) m[k] = (m[k] || 0) + v; return m; }, {});
  const sources = Object.entries(add('sources')).sort((a, b) => b[1] - a[1]);
  const cta = Object.entries(add('cta')).sort((a, b) => b[1] - a[1]);
  const form = (k) => ({ start: sum((d) => d.forms?.[k]?.start), ok: sum((d) => d.forms?.[k]?.ok), error: sum((d) => d.forms?.[k]?.error) });
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const table = (caption, head2, rows) => `<table class="st"><caption>${esc(caption)}</caption><thead><tr>${head2.map((h, i) => `<th scope="col"${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td class="num">${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('') : `<tr><td colspan="${head2.length}" class="st__none">—</td></tr>`}</tbody></table>`;
  const srcLabel = (k) => esc(k.replace(/^direct \/ - \/ -$/, S.direct).replace(/ \/ -/g, ''));
  return `${head(S.h, S.lead, period)}
  <div class="st-grid">
    ${table(S.visits, ['', S.count], [[esc(S.total), `<b>${total}</b>`], [esc(S.sq), views.sq], [esc(S.en), views.en]])}
    ${table(S.forms, [S.form, S.start, S.ok, S.error, S.rate], ['drive', 'order'].map((k) => { const f = form(k); return [esc(t.req.kinds[k]), f.start, f.ok, f.error, `<b>${pct(f.ok, f.start)}</b>`]; }))}
    ${table(S.sources, [S.source, S.count], sources.slice(0, 20).map(([k, v]) => [srcLabel(k), v]))}
    ${table(S.cta, [S.button, S.clicks], cta.map(([k, v]) => [esc(S.ctas[k] || k), v]))}
    ${table(S.search, ['', S.count], [[esc(S.hit), sum((d) => d.search?.hit)], [esc(S.miss), sum((d) => d.search?.miss)]])}
    ${table(S.byDay, [S.day, S.count], [...days].reverse().map((d) => [esc(dayLabel(d.day)), (d.views?.sq || 0) + (d.views?.en || 0)]))}
  </div>
  <p class="field__hint">${esc(S.rate)}: ${esc(S.rateHint)}</p>`;
}

// ---------- requests ----------
function matches(r) {
  const f = state.filter;
  if (f.kind !== 'all' && r.kind !== f.kind) return false;
  if (f.status !== 'any' && r.status !== f.status) return false;
  if (!f.q) return true;
  const hay = [r.data.name, r.data.phone, r.data.email, r.data.carLabel, r.data.model].join(' ').toLowerCase();
  return f.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}
function viewRequests() {
  const R = t.req, all = state.requests, f = state.filter;
  if (!state.loaded.requests) return head(R.h, '', '') + '<div aria-hidden="true">' + '<div class="sk"></div>'.repeat(5) + '</div>';
  const count = (k, v) => all.filter((r) => r[k] === v).length;
  const seg = (name, legend, opts) => `<fieldset class="seg"><legend>${esc(legend)}</legend>${opts.map(([v, l, n]) => `<label><input type="radio" name="${name}" value="${v}"${f[name] === v ? ' checked' : ''}><span>${esc(l)} <b>${n}</b></span></label>`).join('')}</fieldset>`;
  const shown = all.filter(matches);
  const acts = `<a class="btn btn--ghost-ink btn--sm" href="/api/admin/requests.csv" download>${icon.down} ${esc(R.csv)}</a><button type="button" class="btn btn--ghost-ink btn--sm" data-act="refresh">${icon.refresh} ${esc(R.refresh)}</button>`;
  return `${head(R.h, R.lead(all.length), acts)}
  ${all.length ? `<form class="filters" role="search" data-form="filters">
    ${seg('kind', R.kindLabel, [['all', R.kinds.all, all.length], ['drive', R.kinds.drive, count('kind', 'drive')], ['order', R.kinds.order, count('kind', 'order')]])}
    ${seg('status', R.stateLabel, [['any', R.anyState, all.length], ...REQ_STATES.map((s) => [s, R.states[s], count('status', s)])])}
    <div class="search"><label class="visually-hidden" for="rq-q">${esc(R.search)}</label>${icon.search}<input id="rq-q" type="search" name="q" value="${esc(f.q)}" placeholder="${esc(R.search)}" autocomplete="off"></div>
  </form>` : ''}
  ${!all.length ? `<div class="empty"><p>${esc(R.empty)}</p></div>`
    : !shown.length ? `<div class="empty"><p>${esc(R.none)}</p><button type="button" class="btn btn--ghost-ink btn--sm" data-act="clear">${esc(R.clear)}</button></div>`
    : `<ul class="rq-list">${shown.map(rowRequest).join('')}</ul>`}`;
}
function head(h, lead, acts) {
  return `<div class="view__head"><div><h1>${esc(h)}</h1>${lead ? `<p class="view__lead">${esc(lead)}</p>` : ''}</div><div class="view__acts">${acts}</div></div>`;
}
function rowRequest(r) {
  const R = t.req, d = r.data, open = state.open.has(r.id);
  const what = r.kind === 'drive'
    ? `<b>${esc(d.carLabel)}</b><span>${esc(R.showrooms[d.showroom] || d.showroom)} · ${esc(dayLabel(d.date))}, ${esc(d.time)}</span>`
    : `<b>${esc(d.model)}</b><span>${esc(R.budget)} ${euro(d.budget)}${d.yearFrom ? ` · ${esc(R.yearFrom.toLowerCase())} ${d.yearFrom}` : ''}</span>`;
  const tel = d.phone.replace(/[^\d+]/g, '');
  return `<li class="rq" data-id="${esc(r.id)}" data-state="${r.status}">
    <div class="rq__row">
      <div class="state" data-state="${r.status}"><label class="visually-hidden" for="st-${esc(r.id)}">${esc(R.stateLabel)}: ${esc(d.name)}</label><select id="st-${esc(r.id)}" data-act="req-status">${REQ_STATES.map((s) => `<option value="${s}"${s === r.status ? ' selected' : ''}>${esc(R.states[s])}</option>`).join('')}</select></div>
      <span class="kind kind--${r.kind}">${esc(R.kindsShort[r.kind])}</span>
      <div class="who"><b>${esc(d.name)}</b><span><span class="who__c"><a href="tel:${esc(tel)}">${esc(d.phone)}</a><button type="button" class="copy-btn" data-act="copy" data-value="${esc(d.phone)}" aria-label="${esc(t.copy.phone)}: ${esc(d.name)}">${icon.copy}</button></span><span class="who__c"><a href="mailto:${esc(d.email)}">${esc(d.email)}</a><button type="button" class="copy-btn" data-act="copy" data-value="${esc(d.email)}" aria-label="${esc(t.copy.email)}: ${esc(d.name)}">${icon.copy}</button></span></span></div>
      <div class="what">${what}</div>
      <div class="when"><b>${esc(ago(r.createdAt))}</b><time datetime="${esc(r.createdAt)}">${esc(stamp(r.createdAt, true))}</time></div>
      <button type="button" class="rq__toggle" data-act="toggle" aria-expanded="${open}" aria-controls="more-${esc(r.id)}" aria-label="${esc(R.details)}: ${esc(d.name)}">${icon.chev}</button>
    </div>
    <div class="rq__more" id="more-${esc(r.id)}" ${open ? '' : 'hidden'}>
      <div>
        <dl>
          <dt>${esc(R.received)}</dt><dd>${esc(stamp(r.createdAt))}</dd>
          ${r.kind === 'drive' ? `<dt>${esc(R.showroom)}</dt><dd>${esc(R.showrooms[d.showroom] || d.showroom)}</dd><dt>${esc(R.when)}</dt><dd>${esc(dayLabel(d.date))}, ${esc(d.time)}</dd>` : `<dt>${esc(R.budget)}</dt><dd>${euro(d.budget)}</dd>${d.yearFrom ? `<dt>${esc(R.yearFrom)}</dt><dd>${d.yearFrom}</dd>` : ''}`}
          <dt>${esc(R.lang)}</dt><dd>${r.lang === 'en' ? 'English' : 'Shqip'}</dd>
          ${r.source ? `<dt>${esc(t.source)}</dt><dd>${esc([r.source.source, r.source.medium, r.source.campaign].filter(Boolean).join(' / '))}</dd>` : ''}
        </dl>
        ${r.kind === 'drive' ? (d.notes ? `<p class="rq__quote">${esc(d.notes)}</p>` : `<p class="field__hint">${esc(R.noNotes)}</p>`) : ''}
      </div>
      <form class="rq__note field" data-form="note"><label for="note-${esc(r.id)}">${esc(R.note)}</label><textarea id="note-${esc(r.id)}" name="note" maxlength="1000" placeholder="${esc(R.notePh)}">${esc(r.note)}</textarea><button type="submit" class="btn btn--ink btn--sm">${esc(R.saveNote)}</button></form>
      <button type="button" class="btn btn--danger btn--sm" data-act="req-delete">${esc(R.del)}</button>
    </div>
  </li>`;
}
const reqOf = (el) => state.requests.find((r) => r.id === el.closest('.rq')?.dataset.id);

// ---------- cars ----------
function viewCars() {
  const C = t.cars;
  if (!state.loaded.data) return head(C.h, '', '') + '<div aria-hidden="true">' + '<div class="sk"></div>'.repeat(6) + '</div>';
  const acts = `<button type="button" class="btn btn--signal btn--sm" data-act="car-new">${icon.plus} ${esc(C.add)}</button>`;
  const sorted = [...state.cars].sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || b.year - a.year);
  return `${head(C.h, C.lead(state.cars.length), acts)}
  ${state.cars.length ? `<ul class="ct">${sorted.map(rowCar).join('')}</ul>` : `<div class="empty"><p>${esc(C.empty)}</p></div>`}`;
}
function rowCar(c) {
  const C = t.cars, name = `${c.make} ${c.model}`;
  const spec = [c.year, c.km ? `${group(c.km)} km` : null, C.fuels[c.fuel], C.gears[c.gear], C.bodies[c.body]].filter(Boolean).join(' · ');
  return `<li class="ct__row" data-id="${esc(c.id)}">
    <img class="ct__img" src="/media/still-car-${esc(c.img)}.webp" alt="" width="1280" height="840" loading="lazy">
    <div class="ct__name"><span>${esc(c.make)}</span><b>${esc(c.model)}</b></div>
    <div class="ct__spec">${esc(spec)}</div>
    <div class="state" data-state="${c.status}"><label class="visually-hidden" for="cs-${esc(c.id)}">${esc(C.status)}: ${esc(name)}</label><select id="cs-${esc(c.id)}" data-act="car-status">${CAR_STATES.map((s) => `<option value="${s}"${s === c.status ? ' selected' : ''}>${esc(C.statuses[s])}</option>`).join('')}</select></div>
    <div class="price"><label class="visually-hidden" for="cp-${esc(c.id)}">${esc(C.price)}: ${esc(name)}</label><input id="cp-${esc(c.id)}" inputmode="numeric" value="${esc(group(c.price))}" data-act="car-price" autocomplete="off"></div>
    <div class="ct__acts"><button type="button" class="btn btn--ghost-ink btn--sm" data-act="car-edit">${esc(C.edit)}</button><button type="button" class="btn btn--ghost-ink btn--sm" data-act="car-remove">${esc(C.del)}</button></div>
  </li>`;
}
const carOf = (el) => state.cars.find((c) => c.id === el.closest('[data-id]')?.dataset.id);
async function saveCars(next, okMsg) {
  try {
    const res = await api('cars', { method: 'PUT', body: { cars: next } });
    state.cars = res.cars;
    toast(okMsg);
    return true;
  } catch (e) {
    if (e.status !== 401) toast(e.status === 422 ? t.cars.invalid : failText(e), 'error');
    return false;
  } finally { draw(); }
}
const money = (v) => parseInt(String(v).replace(/[^\d]/g, ''), 10);
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function openDrawer(car) {
  const C = t.cars, isNew = !car;
  const c = car || { id: '', make: 'Hyundai', model: '', year: YEAR_MAX - 1, km: 0, fuel: 'petrol', gear: 'auto', body: 'suv', price: '', status: 'new', img: Object.keys(CAR_IMAGES)[0] };
  const opt = (list, labels, v) => list.map((x) => `<option value="${x}"${x === v ? ' selected' : ''}>${esc(labels ? labels[x] : x)}</option>`).join('');
  const field = (id, label, input, extra = '') => `<div class="field"><label for="${id}">${esc(label)}</label>${input}<p class="field__err" id="${id}-e"></p>${extra}</div>`;
  const d = $('#drawer');
  d.dataset.id = isNew ? '' : c.id;
  d.innerHTML = `<form novalidate>
    <div class="drawer__head"><h2 id="drawer-h">${esc(isNew ? C.newCar : C.editCar)}</h2><button type="button" class="icon-btn" data-act="close" aria-label="${esc(C.close)}">${icon.close}</button></div>
    <div class="drawer__body">
      <div class="grid-2">
        ${field('f-make', C.make, `<select id="f-make" name="make">${opt(MAKES, null, c.make)}</select>`)}
        ${field('f-model', C.model, `<input id="f-model" name="model" value="${esc(c.model)}" maxlength="40" autocomplete="off" required>`)}
      </div>
      <div class="grid-3">
        ${field('f-year', C.year, `<input id="f-year" name="year" inputmode="numeric" value="${esc(c.year)}" class="tabular" required>`)}
        ${field('f-km', C.km, `<input id="f-km" name="km" inputmode="numeric" value="${esc(c.km ? group(c.km) : 0)}" class="tabular">`)}
        ${field('f-price', C.price, `<input id="f-price" name="price" inputmode="numeric" value="${esc(c.price ? group(c.price) : '')}" class="tabular" required>`)}
      </div>
      <div class="grid-3">
        ${field('f-fuel', C.fuel, `<select id="f-fuel" name="fuel">${opt(FUELS, C.fuels, c.fuel)}</select>`)}
        ${field('f-gear', C.gear, `<select id="f-gear" name="gear">${opt(GEARS, C.gears, c.gear)}</select>`)}
        ${field('f-body', C.body, `<select id="f-body" name="body">${opt(BODIES, C.bodies, c.body)}</select>`)}
      </div>
      ${field('f-status', C.status, `<select id="f-status" name="status">${opt(CAR_STATES, C.statuses, c.status)}</select>`)}
      <fieldset class="field"><legend class="field__l">${esc(C.img)}</legend><div class="pics">${Object.keys(CAR_IMAGES).map((k) => `<label><input type="radio" name="img" value="${k}"${k === c.img ? ' checked' : ''} aria-label="${esc(k)}"><img src="/media/still-car-${k}.webp" alt="" width="1280" height="840" loading="lazy"></label>`).join('')}</div><p class="field__hint">${esc(C.imgHint)}</p></fieldset>
      ${field('f-id', C.id, `<input id="f-id" name="id" value="${esc(c.id)}" maxlength="41" autocomplete="off" spellcheck="false" ${isNew ? '' : 'readonly'} class="tabular">`, `<p class="field__hint">${esc(C.idHint)}</p>`)}
    </div>
    <div class="drawer__foot"><button type="button" class="btn btn--ghost-ink" data-act="close">${esc(C.cancel)}</button><button type="submit" class="btn btn--signal">${esc(C.save)} ${icon.arrow}</button></div>
  </form>`;
  d.showModal();
  $('#f-model', d).focus();
  if (isNew) {
    // the code follows make, model and year until someone types in it
    const idIn = $('#f-id', d);
    let touched = false;
    idIn.addEventListener('input', () => { touched = true; });
    d.querySelector('form').addEventListener('input', (e) => { if (!touched && e.target !== idIn) idIn.value = slug(`${$('#f-make', d).value}-${$('#f-model', d).value}-${$('#f-year', d).value}`); });
  }
}
function onDrawerClick(e) { if (e.target.closest('[data-act="close"]') || (e.target === e.currentTarget && outside(e.currentTarget, e))) e.currentTarget.close(); }
async function onDrawerSubmit(e) {
  e.preventDefault();
  const d = e.currentTarget, C = t.cars, form = e.target;
  const v = Object.fromEntries(new FormData(form));
  const editing = d.dataset.id;
  const car = { id: editing || slug(v.id || `${v.make}-${v.model}-${v.year}`), make: v.make, model: v.model.trim().replace(/\s+/g, ' '), year: parseInt(v.year, 10), km: money(v.km) || 0, fuel: v.fuel, gear: v.gear, body: v.body, price: money(v.price), status: v.status, img: v.img };
  const bad = {};
  if (!car.model) bad.model = C.errors.model;
  if (!(car.year >= 1990 && car.year <= YEAR_MAX)) bad.year = C.errors.year;
  if (!(car.km >= 0 && car.km <= 1e6)) bad.km = C.errors.km;
  if (!(car.price >= 1000 && car.price <= 500000)) bad.price = C.errors.price;
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(car.id) || (!editing && state.cars.some((x) => x.id === car.id))) bad.id = C.errors.id;
  for (const k of ['model', 'year', 'km', 'price', 'id']) {
    const input = $(`#f-${k}`, d), msg = $(`#f-${k}-e`, d);
    input.toggleAttribute('aria-invalid', !!bad[k]);
    if (bad[k]) input.setAttribute('aria-describedby', msg.id);
    msg.textContent = bad[k] || '';
  }
  const first = Object.keys(bad)[0];
  if (first) { $(`#f-${first}`, d).focus(); return; }
  const btn = form.querySelector('[type=submit]');
  btn.setAttribute('aria-busy', 'true'); btn.firstChild.nodeValue = `${C.saving} `;
  const next = editing ? state.cars.map((x) => (x.id === editing ? car : x)) : [...state.cars, car];
  if (await saveCars(next, C.saved)) d.close();
  else { btn.removeAttribute('aria-busy'); btn.firstChild.nodeValue = `${C.save} `; }
}

// ---------- contact ----------
function viewContact() {
  const K = t.contact;
  if (!state.loaded.data) return head(K.h, '', '') + '<div aria-hidden="true">' + '<div class="sk"></div>'.repeat(4) + '</div>';
  const s = state.site;
  const f = (id, label, value, type = 'text', ph = '') => `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" name="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(ph)}" maxlength="160" autocomplete="off"><p class="field__err" id="${id}-e"></p></div>`;
  return `${head(K.h, K.lead, '')}
  <form class="cform" data-form="contact" novalidate>
    <fieldset><legend>${esc(K.company)}</legend>
      ${f('contact.address', K.address, s.contact.address)}
      <div class="grid-2">${f('contact.phone', K.phone, s.contact.phone, 'tel')}${f('contact.email', K.email, s.contact.email, 'email')}</div>
    </fieldset>
    ${['tirana', 'durres'].map((k) => `<fieldset><legend>${esc(K[k])}</legend><div class="grid-2">${f(`${k}.address`, K.address, s.showrooms[k].address)}${f(`${k}.hours`, K.hours, s.showrooms[k].hours, 'text', K.hoursPh)}</div></fieldset>`).join('')}
    <button type="submit" class="btn btn--signal bar-save">${esc(K.save)} ${icon.arrow}</button>
  </form>`;
}

// ---------- events in the view ----------
async function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'refresh') { b.setAttribute('aria-busy', 'true'); await reloadRequests(); return; }
  if (act === 'copy') {
    try { await navigator.clipboard.writeText(b.dataset.value); toast(t.copy.done); } catch { toast(t.copy.fail, 'error'); }
    return;
  }
  if (act === 'clear') { state.filter = { kind: 'all', status: 'any', q: '' }; draw(); return; }
  if (act === 'toggle') {
    const r = reqOf(b), more = $(`#more-${CSS.escape(r.id)}`);
    const open = more.hidden;
    more.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
    open ? state.open.add(r.id) : state.open.delete(r.id);
    return;
  }
  if (act === 'req-delete') {
    const r = reqOf(b);
    if (!(await confirmBox(t.req.delQ, t.req.delLead, t.req.del))) return;
    try {
      await api(`requests/${encodeURIComponent(r.id)}`, { method: 'DELETE' });
      state.requests = state.requests.filter((x) => x.id !== r.id);
      draw(); toast(t.req.deleted);
    } catch (err) { if (err.status !== 401) toast(failText(err), 'error'); }
    return;
  }
  if (act === 'car-new') return openDrawer(null);
  if (act === 'car-edit') return openDrawer(carOf(b));
  if (act === 'car-remove') {
    const c = carOf(b);
    if (!(await confirmBox(t.cars.delQ(`${c.make} ${c.model} ${c.year}`), t.cars.delLead, t.cars.del))) return;
    saveCars(state.cars.filter((x) => x.id !== c.id), t.cars.removed);
  }
}
async function onChange(e) {
  const el = e.target;
  if (el.dataset.act === 'stats-days') { state.statsDays = +el.value; state.stats = null; draw(); loadStats(); return; }
  if (el.dataset.act === 'req-status') {
    const r = reqOf(el), was = r.status;
    r.status = el.value;
    el.parentElement.dataset.state = el.value;
    el.closest('.rq').dataset.state = el.value;
    try { await api(`requests/${encodeURIComponent(r.id)}`, { method: 'PATCH', body: { status: el.value } }); toast(t.cars.statusSaved); }
    catch (err) { r.status = was; if (err.status !== 401) toast(failText(err), 'error'); }
    draw();
    return;
  }
  if (el.dataset.act === 'car-status') {
    const c = carOf(el);
    saveCars(state.cars.map((x) => (x.id === c.id ? { ...x, status: el.value } : x)), t.cars.statusSaved);
    return;
  }
  if (el.dataset.act === 'car-price') {
    const c = carOf(el), price = money(el.value);
    if (!(price >= 1000 && price <= 500000)) { el.setAttribute('aria-invalid', 'true'); toast(t.cars.errors.price, 'error'); return; }
    el.removeAttribute('aria-invalid');
    if (price !== c.price) saveCars(state.cars.map((x) => (x.id === c.id ? { ...x, price } : x)), t.cars.priceSaved);
    return;
  }
  if (el.closest('[data-form="filters"]') && el.type === 'radio') { state.filter[el.name] = el.value; draw(); $(`[data-form="filters"] input[name="${el.name}"][value="${el.value}"]`)?.focus(); }
}
let searchTimer = 0;
function onInput(e) {
  if (e.target.id !== 'rq-q') return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.filter.q = e.target.value.trim();
    const pos = e.target.selectionStart;
    draw();
    const q = $('#rq-q');
    q.focus(); q.setSelectionRange(pos, pos);
  }, 160);
}
async function onSubmit(e) {
  const form = e.target;
  e.preventDefault();
  if (form.dataset.form === 'note') {
    const r = reqOf(form), note = form.note.value;
    try { await api(`requests/${encodeURIComponent(r.id)}`, { method: 'PATCH', body: { note } }); r.note = note.trim(); toast(t.cars.statusSaved); }
    catch (err) { if (err.status !== 401) toast(failText(err), 'error'); }
    return;
  }
  if (form.dataset.form === 'contact') {
    const v = Object.fromEntries(new FormData(form));
    const site = { contact: { address: v['contact.address'], phone: v['contact.phone'], email: v['contact.email'] }, showrooms: { tirana: { address: v['tirana.address'], hours: v['tirana.hours'] }, durres: { address: v['durres.address'], hours: v['durres.hours'] } } };
    const mail = form.querySelector('[name="contact.email"]'), msg = $('#contact\\.email-e');
    const okMail = !v['contact.email'].trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v['contact.email'].trim());
    mail.toggleAttribute('aria-invalid', !okMail);
    msg.textContent = okMail ? '' : t.contact.invalid;
    if (!okMail) { mail.focus(); return; }
    try { state.site = (await api('site', { method: 'PUT', body: { site } })).site; toast(t.contact.saved); }
    catch (err) { if (err.status !== 401) toast(err.status === 422 ? t.contact.invalid : failText(err), 'error'); }
  }
}

// Netlify's free-plan badge (an iframe it injects bottom right) would sit on the drawer's save button, the toast and
// the last row: when it appears, flag the page so the layout makes room for it (the badge itself is left alone)
const flagBadge = () => { if (document.getElementById('nl-badge-frame')) { document.documentElement.setAttribute('data-has-host-badge', ''); return true; } return false; };
if (!flagBadge()) { const mo = new MutationObserver(() => { if (flagBadge()) mo.disconnect(); }); mo.observe(document.documentElement, { childList: true, subtree: true }); setTimeout(() => mo.disconnect(), 15000); }

boot();
