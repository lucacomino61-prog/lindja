// The hero: one scroll step = one step of a car's journey from Korea. Wheel, swipe, arrow keys and the rail
// all drive it; with motion stopped (or reduced) it shows the stills and keeps every step and card reachable.
import { Film } from './film.js';

const STEPS = 5;

export async function initHero(app) {
  const { gsap, ScrollTrigger, lenis } = app;
  const hero = document.getElementById('lindja-film');
  if (!hero) return;
  const [va, vb] = hero.querySelectorAll('.hero__video');
  const posterImg = hero.querySelector('.hero__poster img');
  const posterSrc = hero.querySelector('.hero__poster source');
  const loader = hero.querySelector('.loader');
  const pct = loader.querySelector('.loader__pct');
  const bar = loader.querySelector('.loader__bar');
  const railBtns = [...hero.querySelectorAll('.rail__btn')];
  const placeName = hero.querySelector('.hero__placename');
  const count = hero.querySelector('.hero__count');
  const wordBox = hero.querySelector('.hero__word');
  const spots = [...hero.querySelectorAll('.spot')];
  const steps = JSON.parse(document.getElementById('hero-steps')?.textContent || '[]');

  const data = await fetch('/media/film.json').then((r) => r.json());
  const phone = matchMedia('(max-aspect-ratio: 4/5)').matches;
  const variant = phone ? 'phone' : 'desktop';
  const film = new Film(va, vb, data, variant);

  // ---------- light: daylight or golden hour (once the golden film exists); remembered on this device ----------
  const srcs = { day: data.variants[variant].src, golden: data.variants[variant].srcGolden };
  const lookBtn = hero.querySelector('.look-toggle');
  let look = 'day';
  try { if (srcs.golden && localStorage.getItem('lindja-look') === 'golden') look = 'golden'; } catch {}
  const sfx = () => (look === 'golden' ? '-golden' : '');
  film.src = srcs[look];
  if (look === 'golden') { posterImg.src = '/media/scene-0-desktop-golden.webp'; if (posterSrc) posterSrc.srcset = '/media/scene-0-phone-golden.webp'; }
  if (srcs.golden && lookBtn) {
    lookBtn.hidden = false;
    lookBtn.setAttribute('aria-pressed', String(look === 'golden'));
    lookBtn.addEventListener('click', async () => {
      look = look === 'golden' ? 'day' : 'golden';
      try { localStorage.setItem('lindja-look', look); } catch {}
      lookBtn.setAttribute('aria-pressed', String(look === 'golden'));
      showStill(step); // the poster under the film, or the still when motion is off
      await film.setSource(srcs[look], gsap);
    });
  }

  let step = 0;
  let locked = window.scrollY < 4;
  let playing = false; // film has taken over from the stills
  const motionOn = () => document.documentElement.dataset.motion !== 'off';

  // ---------- scroll lock ----------
  function lock() { locked = true; lenis.stop(); hero.classList.add('is-locked'); }
  function unlock() { locked = false; lenis.start(); hero.classList.remove('is-locked'); }
  if (locked) lock();
  app.leaveHero = () => { closeCards(); if (locked) unlock(); };

  // ---------- labels ----------
  function setLabels(k, animate = true) {
    hero.dataset.step = k;
    railBtns.forEach((b, i) => (i === k ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    count.textContent = `0${k + 1} / 0${STEPS}`;
    placeName.textContent = steps[k]?.place || '';
    const old = wordBox.querySelector('.hero__word-in');
    const nu = document.createElement('span');
    nu.className = 'hero__word-in';
    nu.textContent = steps[k]?.word || '';
    if (!animate || !motionOn()) { old.replaceWith(nu); return; }
    nu.style.position = 'absolute'; nu.style.left = '0';
    wordBox.style.position = 'relative';
    wordBox.append(nu);
    const dir = k > Number(old.dataset.k || 0) ? 1 : -1;
    nu.dataset.k = k;
    gsap.fromTo(nu, { yPercent: 105 * dir }, { yPercent: 0, duration: 0.9, ease: 'expo.out' });
    gsap.to(old, { yPercent: -105 * dir, duration: 0.7, ease: 'expo.out', onComplete: () => { old.remove(); nu.style.position = ''; } });
  }

  // ---------- hotspots ----------
  const W = () => hero.clientWidth, H = () => hero.clientHeight;
  function placeSpot(el, p) {
    if (!p) { el.classList.remove('is-on'); return; }
    const x = p[0] * W(), y = p[1] * H();
    el.style.setProperty('--x', `${x.toFixed(1)}px`);
    el.style.setProperty('--y', `${y.toFixed(1)}px`);
    el.classList.toggle('spot--left', p[0] > 0.6);
    el.classList.toggle('spot--up', p[1] > 0.55);
  }
  const band = hero.querySelector('.hero__band'), rail = hero.querySelector('.hero__rail');
  let bandY = 0.6, railBox = null, topY = 0.14;
  const measureChrome = () => {
    const hr = hero.getBoundingClientRect(), br = band.getBoundingClientRect(), rr = rail.getBoundingClientRect();
    bandY = (br.top - hr.top) / hr.height - 0.04;
    railBox = { x0: (rr.left - hr.left) / hr.width - 0.12, y1: (rr.bottom - hr.top) / hr.height + 0.06 };
    topY = innerWidth <= 991 ? (rr.bottom - hr.top) / hr.height + 0.03 : 0.14;
  };
  measureChrome();
  addEventListener('resize', measureChrome);
  const bandTop = () => bandY;
  const inRail = (p) => railBox && p[0] > railBox.x0 && p[1] < railBox.y1 && innerWidth > 991;
  function updateSpots() {
    const live = playing && motionOn();
    for (const el of spots) {
      const k = +el.dataset.scene;
      const id = el.dataset.anchor;
      let p = null, show = false;
      if (live) {
        const r = film.spot(id);
        if (r) {
          const [x, y, s] = r;
          p = [x, y];
          // on a move, the stop being left fades early, the stop being reached late
          if (s.type === 'idle') show = s.scene === k;
          else {
            const { i } = film.where();
            const u = i / s.len;
            show = (s.to === k && u > 0.82) || (s.from === k && u < 0.12);
          }
        }
      } else if (k === step) {
        p = film.stillSpot(id, k); show = !!p;
      }
      // keep hotspots off the copy band, the step rail and the header
      const inside = p && p[0] > 0.03 && p[0] < 0.97 && p[1] > topY && p[1] < bandTop() && !inRail(p);
      if (show && inside) { placeSpot(el, p); el.classList.add('is-on'); }
      else if (!el.querySelector('.spot__btn[aria-expanded="true"]')) el.classList.remove('is-on');
    }
  }
  function closeCards(except) {
    for (const el of spots) {
      const b = el.querySelector('.spot__btn');
      if (b === except) continue;
      b.setAttribute('aria-expanded', 'false');
      el.querySelector('.spot__card').hidden = true;
    }
  }
  for (const el of spots) {
    const btn = el.querySelector('.spot__btn');
    const card = el.querySelector('.spot__card');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      closeCards(btn);
      btn.setAttribute('aria-expanded', String(!open));
      card.hidden = open;
    });
    el.querySelector('.spot__close').addEventListener('click', () => { closeCards(); btn.focus(); });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const open = hero.querySelector('.spot__btn[aria-expanded="true"]'); if (open) { closeCards(); open.focus(); } } });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.spot')) closeCards(); });

  // ---------- stills (loading, stopped motion) ----------
  function showStill(k) {
    const d = `/media/scene-${k}-desktop${sfx()}.webp`, p = `/media/scene-${k}-phone${sfx()}.webp`;
    if (posterImg.getAttribute('src') !== d) { posterImg.src = d; if (posterSrc) posterSrc.srcset = p; }
  }

  // ---------- stepping ----------
  let moving = false;
  async function goTo(k) {
    k = Math.max(0, Math.min(STEPS - 1, k));
    if (k === step || moving) return;
    closeCards();
    const from = step;
    step = k;
    setLabels(k);
    if (playing && motionOn()) {
      moving = true;
      const ok = await film.go(from, k, gsap);
      if (!ok) { moving = false; }
    } else {
      showStill(k);
      arrived(k);
    }
  }
  function arrived(k) {
    moving = false;
    if (k === STEPS - 1 && locked) unlock();
  }
  film.onArrive = (k) => arrived(k);
  railBtns.forEach((b) => b.addEventListener('click', () => { if (window.scrollY > 4) return; goTo(+b.dataset.goto); }));

  const isCardEvent = (e) => e?.target?.closest?.('.spot__card');
  ScrollTrigger.observe({
    target: window, type: 'wheel,touch', wheelSpeed: -1, tolerance: 12,
    onUp: (self) => {
      if (isCardEvent(self.event)) return;
      if (locked && !moving) { document.documentElement.setAttribute('data-scrolled', ''); goTo(step + 1); }
    },
    onDown: (self) => {
      if (isCardEvent(self.event)) return;
      if (!locked && window.scrollY <= 2 && step === STEPS - 1) { lock(); goTo(step - 1); return; }
      if (locked && !moving) goTo(step - 1);
    },
  });
  window.addEventListener('keydown', (e) => {
    if (!locked || e.target.closest('input, textarea, select, button, a, summary, [contenteditable]')) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); if (!moving) step === STEPS - 1 ? unlock() : goTo(step + 1); }
    else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (!moving) goTo(step - 1); }
  });
  // coming back to the very top re-locks on the last stop
  ScrollTrigger.create({ trigger: hero, start: 'top top', end: '2px top', onEnterBack: () => { if (!locked) lock(); } });

  // ---------- loading ----------
  const target = (data.segments.find((s) => s.name === 'idle0').start + 144) / data.fps;
  let loaderDone = false;
  function hideLoader() { if (loaderDone) return; loaderDone = true; loader.classList.add('is-done'); }
  async function startFilm(skipIntro) {
    if (playing || !motionOn()) return;
    playing = true;
    await film.begin(skipIntro || step !== 0);
    if (step !== 0) { await film.go(0, step, gsap); }
    gsap.to(posterImg.parentElement, { opacity: 0, duration: 0.4 });
  }
  loader.querySelector('.loader__skip').addEventListener('click', () => {
    hideLoader();
    if (va.readyState >= 3) startFilm(true);
    else skipRequested = true;
  });
  let skipRequested = false;

  if (!motionOn()) {
    hideLoader();
  } else {
    film.load();
    const t0 = performance.now();
    const onProgress = () => {
      let end = 0;
      for (let i = 0; i < va.buffered.length; i++) end = Math.max(end, va.buffered.end(i));
      const p = Math.min(1, end / target);
      pct.textContent = `${Math.round(p * 100)}%`;
      bar.style.setProperty('--p', p.toFixed(3));
      const ready = va.readyState >= 3 && (p >= 0.999 || va.readyState === 4);
      if (ready && !playing) { hideLoader(); startFilm(skipRequested); }
      else if (!loaderDone && performance.now() - t0 > 9000) hideLoader(); // slow line: stills stay up, the film joins later
    };
    va.addEventListener('progress', onProgress);
    va.addEventListener('canplay', onProgress);
    va.addEventListener('canplaythrough', onProgress);
    setTimeout(onProgress, 9100);
  }

  // ---------- motion switch ----------
  document.addEventListener('motionchange', () => {
    if (!motionOn()) { film.pause(); playing = false; showStill(step); gsap.set(posterImg.parentElement, { opacity: 1 }); film.v.forEach((v) => v.classList.remove('is-on')); hideLoader(); }
    else if (!playing) {
      if (!film.A.src) film.load();
      playing = true;
      film.A.classList.add('is-on');
      film.A.currentTime = film.t(film.seg[`idle${step}`].start);
      film.plan = { kind: 'loop', k: step };
      film.busy = false; moving = false;
      film.resume(); film.attachStandby();
      gsap.to(posterImg.parentElement, { opacity: 0, duration: 0.4 });
    }
  });

  // ---------- one clock ----------
  gsap.ticker.add(() => {
    if (playing && motionOn()) {
      film.tick();
      const bar = railBtns[step]?.querySelector('.rail__bar i');
      if (bar) bar.style.setProperty('--p', film.progress().toFixed(3));
    }
    updateSpots();
  });
  setLabels(0, false);
}
