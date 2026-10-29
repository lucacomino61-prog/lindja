// The garage (cars saved with the heart, kept on this device) and compare (up to three cars side by side, for the
// visit). Both open as sheets from the dock; "Ask about these cars" fills the order form with the saved list.
const KEY = 'lindja-garage', CMP = 'lindja-compare';
const load = (store, k) => { try { return new Set(JSON.parse(store.getItem(k) || '[]')); } catch { return new Set(); } };
const save = (store, k, set) => { try { store.setItem(k, JSON.stringify([...set])); } catch {} };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const x = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

export function initGarage(app) {
  const gDlg = document.getElementById('garage'), cDlg = document.getElementById('compare');
  if (!gDlg || !cDlg) return;
  const S = JSON.parse(gDlg.dataset.strings);
  const garage = load(localStorage, KEY), compare = load(sessionStorage, CMP);
  const say = document.querySelector('[data-dock-say]');
  const tell = (m) => { if (say) { say.textContent = ''; setTimeout(() => { say.textContent = m; }, 30); } };
  const car = (id) => {
    const el = document.querySelector(`.car[data-id="${CSS.escape(id)}"]`);
    if (!el) return null;
    const d = el.dataset;
    return { id, el, make: d.make, model: el.querySelector('.car__name').childNodes[1]?.textContent.trim() || '', year: d.year, price: el.querySelector('.car__amount').textContent, img: el.querySelector('.car__img img').getAttribute('src'), fuel: d.fuel, body: d.body, status: d.status, spec: [...el.querySelectorAll('.car__spec span')].map((s) => s.textContent.trim()).join(' · '), km: [...el.querySelectorAll('.car__spec span')].find((s) => /km/i.test(s.textContent))?.textContent || '—', gear: el.querySelector('.car__spec span:last-child')?.textContent || '' };
  };
  function sync() {
    for (const id of [...garage]) if (!car(id)) garage.delete(id); // a car the admin removed
    for (const id of [...compare]) if (!car(id)) compare.delete(id);
    document.querySelectorAll('[data-save]').forEach((b) => b.setAttribute('aria-pressed', String(garage.has(b.dataset.save))));
    document.querySelectorAll('[data-compare]').forEach((b) => b.setAttribute('aria-pressed', String(compare.has(b.dataset.compare))));
    document.querySelectorAll('[data-garage-n]').forEach((n) => { n.textContent = garage.size; n.hidden = !garage.size; });
    document.querySelectorAll('[data-compare-n]').forEach((n) => { n.textContent = compare.size; });
    document.querySelectorAll('[data-compare-open]').forEach((b) => { b.hidden = compare.size < 1; });
  }
  app.syncGarage = sync;

  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-save]'), c = e.target.closest('[data-compare]');
    if (s) {
      const id = s.dataset.save, on = !garage.has(id);
      on ? garage.add(id) : garage.delete(id);
      save(localStorage, KEY, garage); sync();
      s.classList.remove('is-pop'); void s.offsetWidth; if (on) s.classList.add('is-pop');
      document.querySelector('.dock__b[data-garage-open]')?.classList.toggle('is-bump', on);
      tell(on ? S.g.saved : S.g.removed);
    }
    if (c) {
      const id = c.dataset.compare;
      if (!compare.has(id) && compare.size >= 3) { tell(S.c.max); c.classList.remove('is-no'); void c.offsetWidth; c.classList.add('is-no'); return; }
      compare.has(id) ? compare.delete(id) : compare.add(id);
      save(sessionStorage, CMP, compare); sync();
      tell(compare.has(id) ? S.c.added : S.c.removed);
    }
    if (e.target.closest('[data-garage-open]')) openGarage();
    if (e.target.closest('[data-compare-open]')) openCompare();
  });

  const head = (id, h, lead) => `<div class="sheet__head"><div><h2 id="${id}">${esc(h)}</h2><p>${esc(lead)}</p></div><button type="button" class="sheet__x" data-close aria-label="${esc(S.g.close)}">${x}</button></div>`;
  function openGarage() {
    const list = [...garage].map(car).filter(Boolean);
    gDlg.innerHTML = head('garage-h', S.g.title, S.g.lead) + (list.length
      ? `<ul class="sheet__list">${list.map((c) => `<li><img src="${esc(c.img)}" alt="" width="1280" height="840"><div><b>${esc(`${c.make} ${c.model}`)}</b><span class="mono">${esc(c.spec)}</span><span class="sheet__price">${esc(c.price)}</span></div><button type="button" class="btn btn--ghost-ink btn--sm" data-unsave="${esc(c.id)}">${esc(S.g.remove)}</button></li>`).join('')}</ul>
         <div class="sheet__foot"><button type="button" class="btn btn--ink" data-ask-all>${esc(S.g.ask)}</button></div>`
      : `<p class="sheet__empty">${esc(S.g.empty)}</p>`);
    gDlg.showModal();
  }
  function openCompare() {
    const list = [...compare].map(car).filter(Boolean);
    const R = S.c.rows, cat = S.cat;
    const where = (s) => (s === 'new' ? cat.newBadge : s === 'used' ? cat.usedBadge : cat.inKorea);
    const row = (label, f) => `<tr><th scope="row">${esc(label)}</th>${list.map((c) => `<td>${f(c)}</td>`).join('')}</tr>`;
    cDlg.innerHTML = head('compare-h', S.c.title, list.length < 2 ? S.c.need : S.c.lead) + `<div class="cmp-wrap"><table class="cmp">
      <thead><tr><td></td>${list.map((c) => `<th scope="col"><img src="${esc(c.img)}" alt="" width="1280" height="840"><b>${esc(`${c.make} ${c.model}`)}</b><button type="button" class="link-btn" data-uncompare="${esc(c.id)}">${esc(S.g.remove)}</button></th>`).join('')}</tr></thead>
      <tbody>${row(R.price, (c) => `<b>${esc(c.price)}</b>`)}${row(R.year, (c) => esc(c.year))}${row(R.km, (c) => esc(c.km))}${row(R.fuel, (c) => esc(cat.fuels[c.fuel]))}${row(R.gear, (c) => esc(c.gear))}${row(R.body, (c) => esc(cat.bodies[c.body]))}${row(R.where, (c) => esc(where(c.status)))}</tbody>
    </table></div><div class="sheet__foot"><button type="button" class="btn btn--ghost-ink" data-clear-compare>${esc(S.c.clear)}</button></div>`;
    cDlg.showModal();
  }
  for (const d of [gDlg, cDlg]) {
    d.addEventListener('click', (e) => {
      const r = d.getBoundingClientRect();
      const out = e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
      if (e.target.closest('[data-close]') || out) return d.close();
      const un = e.target.closest('[data-unsave]'), uc = e.target.closest('[data-uncompare]');
      if (un) { garage.delete(un.dataset.unsave); save(localStorage, KEY, garage); sync(); openGarage(); }
      if (uc) { compare.delete(uc.dataset.uncompare); save(sessionStorage, CMP, compare); sync(); compare.size ? openCompare() : d.close(); }
      if (e.target.closest('[data-clear-compare]')) { compare.clear(); save(sessionStorage, CMP, compare); sync(); d.close(); }
      if (e.target.closest('[data-ask-all]')) {
        const names = [...garage].map(car).filter(Boolean).map((c) => `${c.make} ${c.model} ${c.year}`).join(', ');
        d.close();
        app.leaveHero?.();
        app.prefillOrder?.(names.slice(0, 80));
        app.lenis.scrollTo(document.getElementById('porosi'), { immediate: !app.motionOn(), duration: 1.1 });
      }
    });
  }
  document.addEventListener('lindja:cars', sync); // the admin's catalogue replaced the cards
  sync();
}
