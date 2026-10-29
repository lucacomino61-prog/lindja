// Mega menu (desktop) and the phone menu sheet.
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
    gsap.to(backdrop, { autoAlpha: 1, duration: 0.25 });
    if (prev) gsap.set(prev, { autoAlpha: 0 });
    gsap.set(p, { autoAlpha: 1 });
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
    gsap.to(container, { height: 0, duration: now ? 0 : 0.2, ease: 'power2.out', onComplete: () => { gsap.set(p, { autoAlpha: 0 }); wrap.dataset.menuOpen = 'false'; } });
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
      if (app.motionOn()) gsap.fromTo(sheet, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' });
      else gsap.set(sheet, { opacity: 1, y: 0 });
      gsap.to(backdrop, { autoAlpha: 1, duration: 0.25 });
      // focus the sheet itself: on a phone, focusing the search box would raise the keyboard over the menu
      sheet.focus({ preventScroll: true });
      note.textContent = '';
    } else {
      gsap.to(backdrop, { autoAlpha: 0, duration: 0.2 });
      const done = () => { sheet.hidden = true; if (!document.getElementById('lindja-film')?.classList.contains('is-locked')) lenis.start(); };
      if (app.motionOn()) gsap.to(sheet, { opacity: 0, y: -8, duration: 0.18, ease: 'power2.out', onComplete: done }); else done();
    }
  }
  burger.addEventListener('click', () => { setSheet(!sheetOpen); if (!sheetOpen) burger.focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetOpen) { setSheet(false); burger.focus(); } });
  backdrop.addEventListener('click', () => sheetOpen && setSheet(false));
  sheet.querySelectorAll('[data-close-menu]').forEach((a) => a.addEventListener('click', () => setSheet(false)));
  void openText;

  // in-page search from the phone sheet: jump to the first section that mentions the word
  sheet.querySelector('.mm-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = sheet.querySelector('input').value.trim();
    const q = raw.toLowerCase();
    if (!q) return;
    const hit = [...document.querySelectorAll('main section')].find((s) => s.id !== 'lindja-film' && s.textContent.toLowerCase().includes(q));
    if (hit) { note.textContent = ''; setSheet(false); app.leaveHero?.(); lenis.resize(); lenis.scrollTo(hit, { immediate: !app.motionOn() }); }
    else note.textContent = note.dataset.none.replace('{q}', raw);
  });
}
