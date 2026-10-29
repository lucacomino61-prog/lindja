// The page's feel, in the world of the route (Incheon → the sea → Durrës → Tirana), on GSAP's one ticker:
// split-flap letters like a port departures board, the header that tucks away while you read and comes back when you
// scroll up, a sliding indicator under the section you are in, labels that roll on hover, magnetic main buttons, car
// cards that tilt toward the pointer, an odometer for changing numbers, the mini dock, and the ship on the progress line.
const FLAP = 'ABCDEFGHIJKLMNOPRSTUVZËÇ0123456789';

// split-flap: each letter turns through a few random ones before it settles, left to right
export function flap(el, gsap, text = el.dataset.text || el.textContent) {
  el.dataset.text = text;
  if (!gsap || document.documentElement.dataset.motion === 'off') { el.textContent = text; return; }
  const chars = [...text];
  const state = { p: 0 };
  gsap.killTweensOf(el._flap || {});
  el._flap = state;
  gsap.to(state, {
    p: 1, duration: 0.45 + chars.length * 0.02, ease: 'power2.out',
    onUpdate: () => {
      const done = Math.floor(state.p * (chars.length + 3));
      el.textContent = chars.map((ch, i) => (i < done - 3 || ch === ' ' ? ch : i < done ? FLAP[(Math.random() * FLAP.length) | 0] : ' ')).join('');
    },
    onComplete: () => { el.textContent = text; },
  });
}

// odometer: each digit is a column of 0–9 that rolls to its new place (CSS transition: no frame loop)
export function odometer(el, text) {
  const chars = [...text];
  if (el.childElementCount !== chars.length || el.dataset.shape !== chars.map((c) => (/\d/.test(c) ? 'd' : c)).join('')) {
    el.dataset.shape = chars.map((c) => (/\d/.test(c) ? 'd' : c)).join('');
    el.innerHTML = chars.map((c) => (/\d/.test(c) ? '<span class="odo"><span class="odo__col">0123456789</span></span>' : `<span class="odo odo--c">${c === ' ' ? '&nbsp;' : c}</span>`)).join('');
  }
  [...el.children].forEach((s, i) => { const d = chars[i]; if (/\d/.test(d)) s.firstChild.style.transform = `translateY(${-d * 10}%)`; });
}

export function initFeel(app) {
  const { gsap, lenis } = app;
  const motion = () => app.motionOn();
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const header = document.querySelector('.site-header');
  const hero = document.getElementById('lindja-film');

  // ---------- labels that roll: the word slides up and its twin comes in from below ----------
  for (const el of document.querySelectorAll('.nav-link, .tool-link, .btn--header, .cta-row .btn, .dock__a, .site-footer__links a, .board__row .board__dest')) {
    if (el.classList.contains('board__dest')) continue; // the board flaps instead
    const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (!node) continue;
    const label = node.textContent.trim();
    const roll = document.createElement('span');
    roll.className = 'roll';
    roll.innerHTML = `<span class="roll__a"></span><span class="roll__b" aria-hidden="true"></span>`;
    roll.firstChild.textContent = label; roll.lastChild.textContent = label;
    node.replaceWith(roll, ' ');
  }

  // ---------- header: tucks away on the way down, back on the way up; the indicator follows the section ----------
  const nav = document.querySelector('.site-nav ul');
  const ind = document.createElement('span');
  ind.className = 'nav-ind'; ind.setAttribute('aria-hidden', 'true');
  nav?.append(ind);
  const KEY = { makinat: 'cars', importi: 'import', porosi: 'import', financim: 'import', udhezues: 'import', sallonet: 'company', 'test-drive': 'company', kontakt: 'contact' };
  const navItem = (k) => (k === 'contact' ? nav?.querySelector('a.nav-link[href="#kontakt"]') : nav?.querySelector(`[data-dropdown-toggle="${k}"]`));
  const sections = [...document.querySelectorAll('main > section[id], footer#kontakt')];
  const dock = document.querySelector('.dock');
  const here = dock?.querySelector('[data-dock-here]');
  const topLabel = here?.textContent || '';
  let current = '', lastY = 0, tucked = false, dockOn = false;
  const label = (s) => (s.id === 'kontakt' ? (navItem('contact')?.querySelector('.roll__a') || navItem('contact'))?.textContent.trim() : [...(s.querySelector('h2')?.childNodes || [])].map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim()); // a heading's block lines keep their space
  function moveInd(k) {
    const el = k && navItem(k);
    const a = nav?.getBoundingClientRect(), b = el?.getBoundingClientRect();
    if (!b || !b.width) { ind.style.opacity = '0'; return; } // no item, or the nav is hidden (phones)
    ind.style.opacity = '1';
    ind.style.transform = `translateX(${(b.left - a.left + 12).toFixed(1)}px) scaleX(${((b.width - 24) / 100).toFixed(3)})`;
  }
  function onScroll(y) {
    const vh = innerHeight;
    const past = hero ? y > hero.offsetTop + hero.offsetHeight - vh * 1.15 : y > vh; // the hero's pinned stage has gone by
    // the header: down past the film and not in use → tucked
    // (keyboard focus only: a tapped burger keeps focus after its menu closes, and that must not pin the header)
    const busy = header.dataset.menuOpen === 'true' || !!header.querySelector(':focus-visible') || !document.getElementById('site-search')?.hidden;
    const want = past && y > lastY + 4 && !busy ? true : y < lastY - 4 || !past ? false : tucked;
    if (want !== tucked) { tucked = want; header.classList.toggle('is-tucked', tucked); }
    lastY = y;
    // which section the reader is in: the last one whose top has passed 40% of the screen
    let s = null;
    for (const sec of sections) if (sec.getBoundingClientRect().top < vh * 0.4) s = sec;
    const id = past && s ? s.id : '';
    if (id !== current) {
      current = id;
      moveInd(KEY[id]);
      if (here) flap(here, gsap, id ? label(s) : topLabel);
    }
    if (dock && past !== dockOn) { dockOn = past; dock.hidden = false; dock.classList.toggle('is-on', past); dock.inert = !past; }
  }
  lenis.on('scroll', ({ scroll }) => onScroll(scroll));
  addEventListener('resize', () => moveInd(KEY[current]));
  onScroll(scrollY);
  document.addEventListener('focusin', (e) => { if (header.contains(e.target) && tucked) { tucked = false; header.classList.remove('is-tucked'); } });
  dock?.querySelector('[data-dock-search]')?.addEventListener('click', () => { header.classList.remove('is-tucked'); tucked = false; document.querySelector('.search-open')?.click() || document.querySelector('.burger')?.click(); });

  // ---------- the ship on the progress line ----------
  const bar = document.querySelector('.scroll-progress');
  if (bar && !bar.querySelector('.scroll-progress__ship')) {
    bar.insertAdjacentHTML('beforeend', '<b class="scroll-progress__ship"><svg viewBox="0 0 28 12"><path d="M1 6h21l5-4v6l-3 3H4Z"/><path d="M6 6V3h9v3" fill="none"/></svg></b>');
    const ship = bar.lastElementChild;
    lenis.on('scroll', ({ progress }) => { ship.style.transform = `translateX(calc(${(progress * 100).toFixed(2)}vw - ${(progress * 30).toFixed(1)}px))`; });
  }

  if (!fine.matches) return;
  // ---------- magnetic main buttons: they lean a few pixels toward the pointer ----------
  for (const b of document.querySelectorAll('.cta-row .btn, .btn--header, .dock__cta')) {
    const x = gsap.quickTo(b, 'x', { duration: 0.4, ease: 'power3.out' }), y = gsap.quickTo(b, 'y', { duration: 0.4, ease: 'power3.out' });
    b.addEventListener('pointermove', (e) => { if (!motion()) return; const r = b.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * 0.18); y((e.clientY - r.top - r.height / 2) * 0.28); });
    b.addEventListener('pointerleave', () => { x(0); y(0); });
  }
  // ---------- car cards tilt toward the pointer, like turning a model car in the hand ----------
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.car__in');
    if (card !== app._tilt) { if (app._tilt) gsap.to(app._tilt, { rotationX: 0, rotationY: 0, duration: 0.5, ease: 'power3.out' }); app._tilt = card; }
    if (!card || !motion() || card.closest('.catalogue[data-view="list"]')) return;
    const r = card.getBoundingClientRect();
    gsap.to(card, { rotationY: ((e.clientX - r.left) / r.width - 0.5) * 6, rotationX: -((e.clientY - r.top) / r.height - 0.5) * 5, transformPerspective: 900, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
  }, { passive: true });
}
