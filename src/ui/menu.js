// Mega menu (desktop) and the phone menu sheet. The mega menu rolls open like a container door; its rows are a port
// departures board whose destinations flap in, and the row you point at shows its picture in the preview window.
import { flap } from './feel.js';
const HOVER_IN = 120, HOVER_OUT = 160;

export function initMenu(app) {
  const { gsap, lenis } = app;
  const wrap = document.querySelector('[data-menu-wrap]');
  const container = wrap.querySelector('[data-dropdown-container]');
  const dropWrap = wrap.querySelector('[data-dropdown-wrapper]');
  const backdrop = document.querySelector('[data-menu-backdrop]');
  const toggles = [...wrap.querySelectorAll('[data-dropdown-toggle]')];
  const panelOf = (name) => wrap.querySelector(`[data-nav-content="${name}"]`);
  const ease = 'expo.out';
  let open = null, tIn = 0, tOut = 0;

  const measure = (p) => { p.style.visibility = 'hidden'; p.style.opacity = '0'; p.style.display = 'grid'; return p.offsetHeight; };

  function show(name) {
    clearTimeout(tOut);
    if (open === name) return;
    const p = panelOf(name);
    const h = measure(p);
    const prev = open ? panelOf(open) : null;
    toggles.forEach((t) => t.setAttribute('aria-expanded', String(t.dataset.dropdownToggle === name)));
    wrap.dataset.menuOpen = 'true';
    gsap.killTweensOf([container, backdrop]);
    gsap.to(container, { height: h, duration: prev ? 0.4 : 0.36, ease });
    // from closed: the door rolls up (clip from the bottom edge); between panels it only changes height
    if (!prev && app.motionOn()) gsap.fromTo(container, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease });
    else gsap.set(container, { clipPath: 'inset(0% 0% 0% 0%)' });
    gsap.to(backdrop, { autoAlpha: 1, duration: 0.25 });
    if (prev) gsap.set(prev, { autoAlpha: 0 });
    gsap.set(p, { autoAlpha: 1 });
    p.querySelectorAll('[data-flap]').forEach((el, i) => setTimeout(() => flap(el, app.motionOn() ? gsap : null), 60 + i * 45));
    const fade = p.querySelectorAll('[data-menu-fade]');
    // opacity, not autoAlpha: a link under visibility:hidden can't take the focus ArrowDown gives it
    if (app.motionOn()) gsap.fromTo(fade, { opacity: 0, y: prev ? 0 : -14, x: prev ? 10 : 0 }, { opacity: 1, y: 0, x: 0, duration: 0.32, stagger: 0.05, ease: 'power3.out' });
    else gsap.set(fade, { opacity: 1 });
    open = name;
  }
  function hide(now = false) {
    clearTimeout(tIn);
    if (!open) return;
    const p = panelOf(open);
    toggles.forEach((t) => t.setAttribute('aria-expanded', 'false'));
    open = null;
    gsap.killTweensOf([container, backdrop]);
    if (!now && app.motionOn()) gsap.to(container, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.22, ease: 'power2.out' }); // the door comes down
    gsap.to(container, { height: 0, duration: now ? 0 : 0.22, ease: 'power2.out', onComplete: () => { gsap.set(p, { autoAlpha: 0 }); wrap.dataset.menuOpen = 'false'; } });
    gsap.to(backdrop, { autoAlpha: 0, duration: now ? 0 : 0.2 });
  }

  for (const t of toggles) {
    const name = t.dataset.dropdownToggle;
    // the underline grows from the side the pointer came in
    t.addEventListener('pointerenter', (e) => {
      const r = t.getBoundingClientRect();
      t.style.setProperty('--from', e.clientX < r.left + r.width / 2 ? 'left' : 'right');
      if (e.pointerType !== 'mouse') return;
      clearTimeout(tOut); clearTimeout(tIn);
      tIn = setTimeout(() => show(name), open ? 0 : HOVER_IN);
    });
    t.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'mouse') return; clearTimeout(tIn); tOut = setTimeout(() => hide(), HOVER_OUT); });
    t.addEventListener('click', () => (open === name ? hide() : show(name)));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); show(name); panelOf(name).querySelector('a')?.focus(); }
    });
  }
  // the preview window follows the row you point at (or tab to)
  const preview = (row) => {
    const fig = row.closest('.mega__panel')?.querySelector('.mega__preview');
    const img = fig?.querySelector('img'), src = row.dataset.preview;
    if (!img || img.getAttribute('src') === src) return;
    fig.querySelector('figcaption').textContent = row.querySelector('.board__dest').dataset.text || row.querySelector('.board__dest').textContent;
    if (!app.motionOn()) { img.src = src; return; }
    gsap.to(img, { opacity: 0, scale: 1.04, duration: 0.14, ease: 'power2.out', onComplete: () => { img.src = src; gsap.to(img, { opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out' }); } });
  };
  dropWrap.addEventListener('pointerover', (e) => { const r = e.target.closest('.board__row'); if (r) preview(r); });
  dropWrap.addEventListener('focusin', (e) => { const r = e.target.closest('.board__row'); if (r) preview(r); });
  dropWrap.addEventListener('pointerenter', () => clearTimeout(tOut));
  dropWrap.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') tOut = setTimeout(() => hide(), HOVER_OUT); });
  backdrop.addEventListener('click', () => hide());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return;
    const t = toggles.find((x) => x.dataset.dropdownToggle === open);
    hide(); t?.focus();
  });
  wrap.addEventListener('focusout', (e) => { if (open && !wrap.contains(e.relatedTarget)) hide(); });
  wrap.querySelectorAll('[data-close-menu]').forEach((a) => a.addEventListener('click', () => hide(true)));

  // ---------- phone sheet ----------
  const burger = wrap.querySelector('.burger');
  const sheet = document.getElementById('mobile-menu');
  const note = sheet.querySelector('.mm-search__note');
  const label = burger.querySelector('span');
  const openText = label.textContent;
  let sheetOpen = false;
  function setSheet(on) {
    sheetOpen = on;
    burger.setAttribute('aria-expanded', String(on));
    if (on) {
      sheet.hidden = false;
      lenis.stop();
      gsap.killTweensOf(sheet);
      // the sheet rolls down like the container door; its rows fade in one after another (opacity only: they are taps)
      if (app.motionOn()) {
        gsap.set(sheet, { opacity: 1, y: 0 });
        gsap.fromTo(sheet, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.45, ease: 'expo.out' });
        gsap.fromTo(sheet.querySelectorAll('.mm-search, .mm-list > li, .btn--block, .lang--menu'), { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: 0.045, delay: 0.1, ease: 'power2.out', clearProps: 'opacity' });
      } else gsap.set(sheet, { opacity: 1, y: 0, clipPath: 'none' });
      gsap.to(backdrop, { autoAlpha: 1, duration: 0.25 });
      // focus the sheet itself: on a phone, focusing the search box would raise the keyboard over the menu
      sheet.focus({ preventScroll: true });
      note.textContent = '';
    } else {
      gsap.to(backdrop, { autoAlpha: 0, duration: 0.2 });
      const done = () => { sheet.hidden = true; if (!document.getElementById('lindja-film')?.classList.contains('is-locked')) lenis.start(); };
      if (app.motionOn()) gsap.to(sheet, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.22, ease: 'power2.out', onComplete: done }); else done();
    }
  }
  burger.addEventListener('click', () => { setSheet(!sheetOpen); if (!sheetOpen) burger.focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetOpen) { setSheet(false); burger.focus(); } });
  backdrop.addEventListener('click', () => sheetOpen && setSheet(false));
  sheet.querySelectorAll('[data-close-menu]').forEach((a) => a.addEventListener('click', () => setSheet(false)));
  void openText;

  // the search inside the sheet lives in search.js; its result links carry data-close-menu
  sheet.addEventListener('click', (e) => { if (e.target.closest('.search-results a')) setSheet(false); });
}
