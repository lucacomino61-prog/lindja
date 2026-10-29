// Below the film: in-page links, the car catalogue (filters in the URL hash, grid or list), and the five-step
// import strip that scrolls sideways on wide screens. The scroll reveals live in reveals.js.
import { carCard, priceCap, esc } from '../build/car-card.js';

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

  // ---------- catalogue ----------
  const cat = document.getElementById('makinat');
  if (cat) {
    const form = cat.querySelector('.filters');
    let items = [...cat.querySelectorAll('.car')];
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
      const newly = [];
      const shown = items.filter((el) => {
        const d = el.dataset;
        const ok = (!v.status || d.status === v.status) && (!v.make || d.make === v.make) && (!v.body || d.body === v.body) && (!v.fuel || d.fuel === v.fuel) && +d.price <= max;
        if (ok && el.hidden) newly.push(el);
        el.hidden = !ok;
        return ok;
      });
      const [key, dir] = (v.sort || 'price-asc').split('-');
      shown.sort((a, b) => (dir === 'asc' ? 1 : -1) * (+a.dataset[key] - +b.dataset[key]));
      // FLIP: remember where each card was, reorder, then slide from there; cards coming back fade in
      const first = new Map(shown.map((el) => [el, el.getBoundingClientRect()]));
      shown.forEach((el) => list.append(el));
      if (app.motionOn()) {
        for (const el of shown) {
          const a = first.get(el), b = el.getBoundingClientRect();
          if (a.width && (a.left !== b.left || a.top !== b.top)) gsap.fromTo(el, { x: a.left - b.left, y: a.top - b.top }, { x: 0, y: 0, duration: 0.45, ease: 'power3.out' });
        }
        if (newly.length) gsap.fromTo(newly, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out', clearProps: 'opacity' });
      }
      app.onCarsShown?.(newly);
      count.textContent = tpl.replace('{n}', shown.length);
      empty.hidden = shown.length > 0;
      ScrollTrigger.refresh();
    }
    form.addEventListener('input', apply);
    form.addEventListener('change', apply);
    form.addEventListener('submit', (e) => e.preventDefault());
    empty.querySelector('[data-reset]').addEventListener('click', () => { form.reset(); apply(); });
    // values come from the URL: only ones the form offers are applied
    app.applyFilters = (q) => {
      form.reset();
      const radio = [...form.querySelectorAll('input[name="status"]')].find((r) => r.value === q.get('t'));
      if (radio) radio.checked = true;
      for (const [key, sel] of [['m', '#f-make'], ['f', '#f-fuel']]) {
        const s = form.querySelector(sel);
        if ([...s.options].some((o) => o.value === q.get(key))) s.value = q.get(key);
      }
      apply();
    };
    // the admin's catalogue (ui/live.js): redraw the cards, the make list and the slider's top, keep the filters
    app.setCatalogue = (cars, strings, lang) => {
      list.innerHTML = cars.map((x) => carCard(x, strings, lang)).join('');
      items = [...list.querySelectorAll('.car')];
      const make = form.querySelector('#f-make');
      const keep = make.value;
      make.innerHTML = make.options[0].outerHTML + [...new Set(cars.map((x) => x.make))].map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
      if ([...make.options].some((o) => o.value === keep)) make.value = keep;
      const range = form.querySelector('#f-price');
      const atTop = +range.value >= +range.max;
      range.max = range.defaultValue = String(priceCap(cars));
      if (atTop) range.value = range.max;
      apply();
    };
    // grid / list, remembered per visitor; switching crossfades the list
    const btns = [...cat.querySelectorAll('.view-switch button')];
    const setView = (v, fade = true) => {
      cat.dataset.view = v;
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
      try { localStorage.setItem('lindja-view', v); } catch {}
      if (fade && app.motionOn()) gsap.fromTo(list, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out', clearProps: 'opacity' });
      ScrollTrigger.refresh();
    };
    btns.forEach((b) => b.addEventListener('click', () => { if (cat.dataset.view !== b.dataset.view) setView(b.dataset.view); }));
    try { if (localStorage.getItem('lindja-view') === 'list') setView('list', false); } catch {}
    apply();
  }

  // a shared link with catalogue filters (/#makinat?m=Genesis) matches no id, so the browser won't jump:
  // filter and jump here, before the hero reads the scroll position and decides to hold it
  const [hashId, hashQuery] = location.hash.slice(1).split('?');
  const hashEl = hashQuery && document.getElementById(hashId);
  if (hashEl) {
    if (hashId === 'makinat') app.applyFilters?.(new URLSearchParams(hashQuery));
    hashEl.scrollIntoView({ block: 'start' });
  }

  // ---------- import strip: pinned and scrolled sideways on wide screens ----------
  const route = document.getElementById('importi');
  if (route) {
    const frame = route.querySelector('.route__track');
    const track = route.querySelector('.legs');
    const line = route.querySelector('.route__line i');
    const legs = [...route.querySelectorAll('.leg')];
    const pics = legs.map((l) => l.querySelector('.leg__img img'));
    const paint = (p) => {
      line.style.transform = `scaleX(${p.toFixed(4)})`;
      legs.forEach((l, i) => l.classList.toggle('is-on', p >= i / legs.length - 0.001));
    };
    paint(app.motionOn() ? 0 : 1);
    let strip = null;
    const build = () => {
      if (strip || !app.motionOn() || innerWidth < 992) return;
      // the strip is max-content wide: it travels its own width minus the frame it is seen through
      const dist = () => Math.max(0, track.scrollWidth - frame.clientWidth);
      const tw = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: route, start: 'top top', end: () => `+=${dist() + innerHeight * 0.4}`, pin: route.querySelector('.route__pin'), scrub: 0.5, invalidateOnRefresh: true, onUpdate: (s) => paint(s.progress) } });
      // each picture slides inside its frame as the strip carries it across
      const drift = pics.map((img, i) => gsap.fromTo(img, { xPercent: -7, scale: 1.16 }, { xPercent: 7, scale: 1.16, ease: 'none', scrollTrigger: { trigger: legs[i], containerAnimation: tw, start: 'left right', end: 'right left', scrub: true } }));
      strip = () => {
        drift.forEach((d) => { d.scrollTrigger?.kill(); d.kill(); });
        tw.scrollTrigger?.kill(); tw.kill();
        gsap.set(track, { clearProps: 'x' }); gsap.set(pics, { clearProps: 'transform' });
      };
    };
    const teardown = () => { strip?.(); strip = null; };
    mm.add('(min-width: 992px)', () => { build(); return teardown; });
    mm.add('(max-width: 991px)', () => {
      const st = ScrollTrigger.create({ trigger: route, start: 'top 70%', end: 'bottom 60%', onUpdate: (s) => paint(app.motionOn() ? s.progress : 1) });
      return () => st.kill();
    });
    document.addEventListener('motionchange', () => {
      if (app.motionOn()) { build(); ScrollTrigger.sort(); ScrollTrigger.refresh(); }
      else { teardown(); paint(1); ScrollTrigger.refresh(); }
    });
  }
}
