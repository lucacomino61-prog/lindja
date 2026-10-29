// Site search: the cars (make, model, year, fuel, body), the page's sections, the five import steps and the guides.
// One index, two places: the header panel on wide screens ("/" opens it) and the phone menu. Accents don't matter
// ("durres" finds Durrës). Arriving with ?q= (the 404 page's search) opens it with that query.
export function initSearch(app) {
  const panel = document.getElementById('site-search');
  if (!panel) return;
  const kinds = JSON.parse(panel.dataset.kinds || '{}');
  const opener = document.querySelector('.search-open');
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ë/g, 'e').replace(/ç/g, 'c');
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  // built when first needed, so it sees the admin's live catalogue
  const index = () => [
    ...[...document.querySelectorAll('.car')].map((c) => ({ kind: 'car', title: text(c.querySelector('.car__name')).replace(/^(\S+)\s/, '$1 '), sub: text(c.querySelector('.car__spec')) + ' · ' + text(c.querySelector('.car__amount')), extra: c.dataset.make + ' ' + c.dataset.body + ' ' + c.dataset.fuel, href: `#car-${c.dataset.id}` })),
    ...[...document.querySelectorAll('main section[id] > h2, main section[id] .catalogue__head h2, main section[id] h2')].filter((h, i, a) => a.indexOf(h) === i && h.closest('section').id !== 'lindja-film').map((h) => ({ kind: 'section', title: text(h), sub: text(h.closest('section').querySelector('h2 + p, .catalogue__head p, .route__head p')), href: `#${h.closest('section').id}` })),
    ...[...document.querySelectorAll('.leg')].map((l) => ({ kind: 'step', title: text(l.querySelector('.leg__place')), sub: text(l.querySelector('.leg__text')), href: '#importi' })),
    ...[...document.querySelectorAll('.guide')].map((g) => ({ kind: 'guide', title: text(g.querySelector('.guide__k')), sub: text(g.querySelector('h3')) + ' · ' + text(g.querySelector('p:last-child')), href: '#udhezues' })),
  ];
  function find(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return index()
      .map((r) => {
        const t = norm(r.title), all = `${t} ${norm(r.sub)} ${norm(r.extra)}`;
        if (!words.every((w) => all.includes(w))) return null;
        const score = (t.startsWith(words[0]) ? 3 : 0) + words.filter((w) => t.includes(w)).length * 2 + (r.kind === 'car' ? 1 : 0);
        return { ...r, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function draw(list, note, q) {
    const hits = find(q);
    list.innerHTML = hits.map((r) => `<li><a href="${esc(r.href)}" data-close-menu><span class="search-results__k mono">${esc(kinds[r.kind] || r.kind)}</span><b>${esc(r.title)}</b>${r.sub ? `<span class="search-results__sub">${esc(r.sub.slice(0, 110))}</span>` : ''}</a></li>`).join('');
    note.textContent = !q.trim() ? '' : hits.length ? note.dataset.count.replace('{n}', hits.length) : note.dataset.none.replace('{q}', q.trim());
    return hits.length;
  }
  const report = (q, n) => { if (q.trim().length >= 2) document.dispatchEvent(new CustomEvent('lindja:track', { detail: { type: 'search', hit: n > 0 } })); };

  // ---------- header panel ----------
  const input = panel.querySelector('input'), list = panel.querySelector('.search-results'), note = panel.querySelector('.search-note');
  let typing = 0;
  function open(q = '') {
    panel.hidden = false;
    opener?.setAttribute('aria-expanded', 'true');
    input.value = q;
    if (q) draw(list, note, q);
    input.focus();
  }
  function close(returnFocus = true) {
    if (panel.hidden) return;
    panel.hidden = true;
    opener?.setAttribute('aria-expanded', 'false');
    if (returnFocus) opener?.focus();
  }
  opener?.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.querySelector('.site-search__close').addEventListener('click', () => close());
  input.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => draw(list, note, input.value), 90); });
  panel.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const n = draw(list, note, input.value); report(input.value, n); list.querySelector('a')?.focus(); });
  panel.addEventListener('keydown', (e) => {
    const links = [...list.querySelectorAll('a')], i = links.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); links[Math.min(links.length - 1, i + 1)].focus(); }
    else if (e.key === 'ArrowUp' && i >= 0) { e.preventDefault(); (i === 0 ? input : links[i - 1]).focus(); }
  });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) { report(input.value, list.children.length); close(false); } });
  document.addEventListener('pointerdown', (e) => { if (!panel.hidden && !panel.contains(e.target) && !opener?.contains(e.target)) close(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.target.closest('input, textarea, select, [contenteditable]') || !opener || getComputedStyle(opener).display === 'none') return;
    e.preventDefault();
    open();
  });

  // ---------- phone menu: the same results inside the sheet ----------
  const sheet = document.getElementById('mobile-menu');
  const mForm = sheet?.querySelector('.mm-search'), mList = sheet?.querySelector('.search-results'), mNote = sheet?.querySelector('.search-note');
  if (mForm) {
    const mInput = mForm.querySelector('input');
    mInput.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => draw(mList, mNote, mInput.value), 90); });
    mForm.addEventListener('submit', (e) => { e.preventDefault(); report(mInput.value, draw(mList, mNote, mInput.value)); mList.querySelector('a')?.focus(); });
  }

  // ---------- ?q= from the 404 page ----------
  const q = new URLSearchParams(location.search).get('q');
  if (q) {
    const phone = !opener || getComputedStyle(opener).display === 'none';
    setTimeout(() => {
      if (!phone) { open(q); report(q, list.children.length); return; }
      document.querySelector('.burger')?.click();
      const mInput = mForm.querySelector('input');
      mInput.value = q;
      report(q, draw(mList, mNote, q));
    }, 300);
  }
}
