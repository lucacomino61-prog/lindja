// Below the film: in-page links, the transporter that drives across the manifesto, the car catalogue
// (filters in the URL hash, grid or list), and the five-step import strip that scrolls sideways.
export function initSections(app) {
  const { gsap, ScrollTrigger, lenis } = app;
  const mm = gsap.matchMedia();

  // ---------- in-page links (with optional catalogue filters: #makinat?t=new&m=Kia&f=ev) ----------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const [id, query] = a.getAttribute('href').slice(1).split('?');
    const el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    if (id !== 'lindja-film') app.leaveHero?.();
    if (query) app.applyFilters?.(new URLSearchParams(query));
    if (a.dataset.car) app.preselectCar?.(a.dataset.car);
    if (a.dataset.ask) app.prefillOrder?.(a.dataset.ask);
    lenis.resize();
    lenis.scrollTo(el, { immediate: !app.motionOn(), duration: 1.1, onComplete: () => { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } });
    history.replaceState(null, '', `#${id}`);
  });

  mm.add({ motion: 'not (prefers-reduced-motion: reduce)' }, () => {
    if (!app.motionOn()) return;
    const truck = document.querySelector('.manifest__truck');
    if (truck && innerWidth > 560) gsap.fromTo(truck, { x: '30vw' }, { x: '-80vw', ease: 'none', scrollTrigger: { trigger: '.manifest', start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
    gsap.from('.manifest__line', { yPercent: 18, autoAlpha: 0, duration: 1.1, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.manifest', start: 'top 70%' } });
  });

  // ---------- catalogue ----------
  const cat = document.getElementById('makinat');
  if (cat) {
    const form = cat.querySelector('.filters');
    const items = [...cat.querySelectorAll('.car')];
    const list = cat.querySelector('.car-list');
    const count = cat.querySelector('.catalogue__count');
    const tpl = count.dataset.countTpl;
    const empty = cat.querySelector('.catalogue__empty');
    const out = form.querySelector('#f-price-out');
    const lang = document.documentElement.lang;
    const euro = (n) => (lang === 'sq' ? `€ ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}` : `€${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);
    function apply() {
      const v = Object.fromEntries(new FormData(form));
      const max = +v.price;
      out.textContent = euro(max);
      const shown = items.filter((el) => {
        const d = el.dataset;
        const ok = (!v.status || d.status === v.status) && (!v.make || d.make === v.make) && (!v.body || d.body === v.body) && (!v.fuel || d.fuel === v.fuel) && +d.price <= max;
        el.hidden = !ok;
        return ok;
      });
      const [key, dir] = (v.sort || 'price-asc').split('-');
      shown.sort((a, b) => (dir === 'asc' ? 1 : -1) * (+a.dataset[key] - +b.dataset[key]));
      // FLIP: remember where each card was, reorder, then slide from there
      const first = new Map(shown.map((el) => [el, el.getBoundingClientRect()]));
      shown.forEach((el) => list.append(el));
      if (app.motionOn()) for (const el of shown) {
        const a = first.get(el), b = el.getBoundingClientRect();
        if (a.width && (a.left !== b.left || a.top !== b.top)) gsap.fromTo(el, { x: a.left - b.left, y: a.top - b.top }, { x: 0, y: 0, duration: 0.45, ease: 'power3.out' });
      }
      count.textContent = tpl.replace('{n}', shown.length);
      empty.hidden = shown.length > 0;
      ScrollTrigger.refresh();
    }
    form.addEventListener('input', apply);
    form.addEventListener('change', apply);
    form.addEventListener('submit', (e) => e.preventDefault());
    empty.querySelector('[data-reset]').addEventListener('click', () => { form.reset(); apply(); });
    app.applyFilters = (q) => {
      form.reset();
      if (q.get('t')) form.querySelector(`input[name="status"][value="${q.get('t')}"]`).checked = true;
      if (q.get('m')) form.querySelector('#f-make').value = q.get('m');
      if (q.get('f')) form.querySelector('#f-fuel').value = q.get('f');
      apply();
    };
    // grid / list, remembered per visitor
    const btns = [...cat.querySelectorAll('.view-switch button')];
    const setView = (v) => { cat.dataset.view = v; btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v))); try { localStorage.setItem('lindja-view', v); } catch {} ScrollTrigger.refresh(); };
    btns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    try { if (localStorage.getItem('lindja-view') === 'list') setView('list'); } catch {}
    apply();
  }

  // ---------- import strip: pinned and scrolled sideways on wide screens ----------
  const route = document.getElementById('importi');
  if (route) {
    const track = route.querySelector('.legs');
    const line = route.querySelector('.route__line path');
    const legs = [...route.querySelectorAll('.leg')];
    const paint = (p) => {
      line.style.strokeDashoffset = String(1 - p);
      legs.forEach((l, i) => l.classList.toggle('is-on', p >= i / legs.length - 0.001));
    };
    paint(app.motionOn() ? 0 : 1);
    mm.add('(min-width: 992px)', () => {
      if (!app.motionOn()) { paint(1); return; }
      const dist = () => Math.max(0, track.scrollWidth - track.clientWidth);
      const tw = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: route, start: 'top top', end: () => `+=${dist() + innerHeight * 0.4}`, pin: route.querySelector('.route__pin'), scrub: 0.5, invalidateOnRefresh: true, onUpdate: (s) => paint(s.progress) } });
      return () => { tw.scrollTrigger?.kill(); tw.kill(); gsap.set(track, { clearProps: 'x' }); };
    });
    mm.add('(max-width: 991px)', () => {
      const st = ScrollTrigger.create({ trigger: route, start: 'top 70%', end: 'bottom 60%', onUpdate: (s) => paint(app.motionOn() ? s.progress : 1) });
      return () => st.kill();
    });
    document.addEventListener('motionchange', () => { if (!app.motionOn()) paint(1); });
  }
}
