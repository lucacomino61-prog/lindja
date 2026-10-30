// The hero: the car's route from Korea as a 3D world drawn live and driven by the scroll. The section is tall and its
// stage stays pinned while you scroll through it: the camera flies stop to stop, LINDJA STAR sails out of Incheon and
// docks in Durrës, the weather turns on the way. Until the world is built (and whenever motion is stopped or reduced,
// or WebGL 2 is missing) the still of the nearest stop stands in, and every stop and card stays reachable.
const STEPS = 5;
const DWELL = 0.12; // share of each leg's scroll spent standing at its two stops (the copy can be read there)

const uFromS = (s) => { const q = Math.min(0.99999, Math.max(0, s)) * (STEPS - 1), k = Math.floor(q), f = q - k; return k + Math.min(1, Math.max(0, (f - DWELL) / (1 - 2 * DWELL))); };
const sFromU = (k) => k / (STEPS - 1);

// the device decides the starting tier; the frame clock adjusts the resolution from there
function pickTier() {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2');
    if (!gl) return null;
    const d = gl.getExtension('WEBGL_debug_renderer_info'), name = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const touch = matchMedia('(pointer: coarse)').matches, mem = navigator.deviceMemory || 8;
    if (/swiftshader|llvmpipe|software/i.test(name)) return null;
    if (touch) return mem <= 3 ? 'low' : 'mid';
    if (/Intel.*(HD|UHD) Graphics|Mali|Adreno [1-5]/i.test(name)) return 'low';
    if (/Intel|Iris/i.test(name)) return 'mid';
    return 'high';
  } catch { return null; }
}

export async function initHero(app) {
  const { gsap, lenis } = app;
  const hero = document.getElementById('lindja-film');
  if (!hero) return;
  const pin = hero.querySelector('.hero__pin');
  const canvas = hero.querySelector('.hero__canvas');
  const posterImg = hero.querySelector('.hero__poster img');
  const posterSrc = hero.querySelector('.hero__poster source');
  const loader = hero.querySelector('.loader');
  const railBtns = [...hero.querySelectorAll('.rail__btn')];
  const placeName = hero.querySelector('.hero__placename');
  const count = hero.querySelector('.hero__count');
  const wordBox = hero.querySelector('.hero__word');
  const spots = [...hero.querySelectorAll('.spot')];
  const steps = JSON.parse(document.getElementById('hero-steps')?.textContent || '[]');
  const motionOn = () => document.documentElement.dataset.motion !== 'off';
  const phone = () => matchMedia('(max-aspect-ratio: 4/5)').matches;

  // ---------- where the scroll stands on the route ----------
  const range = () => Math.max(1, hero.offsetHeight - pin.offsetHeight);
  const sNow = () => (window.scrollY - hero.offsetTop) / range();
  let u = uFromS(sNow()), step = Math.round(u);
  const scrollToStep = (k, immediate) => lenis.scrollTo(hero.offsetTop + sFromU(k) * range(), { immediate: immediate || !motionOn(), duration: 1.6, force: true });
  railBtns.forEach((b) => b.addEventListener('click', () => scrollToStep(+b.dataset.goto)));
  app.leaveHero = () => closeCards();

  // ---------- labels ----------
  function setLabels(k, animate = true) {
    hero.dataset.step = k;
    railBtns.forEach((b, i) => (i === k ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    count.textContent = `0${k + 1} / 0${STEPS}`;
    placeName.textContent = steps[k]?.place || '';
    // one word in the box: the one arriving; a fast scroll finishes every word still on its way out first
    const all = [...wordBox.querySelectorAll('.hero__word-in')];
    const old = all.at(-1);
    all.slice(0, -1).forEach((n) => { gsap.killTweensOf(n); n.remove(); });
    const nu = document.createElement('span');
    nu.className = 'hero__word-in';
    nu.textContent = steps[k]?.word || '';
    nu.dataset.k = k;
    if (!animate || !motionOn() || !old) { if (old) { gsap.killTweensOf(old); old.remove(); } wordBox.append(nu); return; }
    gsap.killTweensOf(old);
    const dir = k > Number(old.dataset.k || 0) ? 1 : -1;
    // the leaving word lies over the arriving one (absolute), so the box only ever measures one word
    wordBox.style.position = 'relative';
    old.style.position = 'absolute'; // no top/left: it keeps its own place (the box's padding included)
    wordBox.append(nu);
    gsap.fromTo(nu, { yPercent: 105 * dir }, { yPercent: 0, duration: 0.9, ease: 'expo.out' });
    gsap.to(old, { yPercent: -105 * dir, duration: 0.7, ease: 'expo.out', onComplete: () => old.remove() });
  }
  const rails = railBtns.map((b) => b.querySelector('.rail__bar i'));
  const paintRail = () => rails.forEach((r, i) => r?.style.setProperty('--p', Math.min(1, Math.max(0, u - i + 1)).toFixed(3)));

  // ---------- stills: loading, stopped motion, no WebGL ----------
  const sfx = (k) => (k === 4 ? '-golden' : ''); // Tirana's still is the golden hour, as the live world shows it
  function showStill(k) {
    const d = `/media/scene-${k}-desktop${sfx(k)}.webp`, p = `/media/scene-${k}-phone${sfx(k)}.webp`;
    if (posterImg.getAttribute('src') !== d) { posterImg.src = d; if (posterSrc) posterSrc.srcset = p; }
  }
  let still = null; // film.json's anchor tracks: where the hotspots sit on each still
  fetch('/media/film.json').then((r) => r.json()).then((d) => { still = d; }).catch(() => {});
  const stillSpot = (id, k) => { const tr = still?.variants?.[phone() ? 'phone' : 'desktop']?.tracks?.[`idle${k}`]?.[id]; return tr && tr[0] != null ? [tr[0], tr[1]] : null; };

  // ---------- hotspots ----------
  const W = () => pin.clientWidth, H = () => pin.clientHeight;
  function placeSpot(el, p) {
    const x = p[0] * W(), y = p[1] * H();
    // on the button and the card, not on .spot: a transformed .spot would trap the phone's fixed card
    const tf = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    if (el._tf !== tf) { el._tf = tf; el._btn.style.transform = tf; el._card.style.transform = tf; }
    el.classList.toggle('spot--left', p[0] > 0.6);
    el.classList.toggle('spot--up', p[1] > 0.55);
  }
  const band = hero.querySelector('.hero__band'), rail = hero.querySelector('.hero__rail');
  const hint = hero.querySelector('.hero__hint'), proto = hero.querySelector('.proto-badge');
  let bandY = 0.6, railBox = null, topY = 0.14, avoid = [];
  const measureChrome = () => {
    const hr = pin.getBoundingClientRect(), br = band.getBoundingClientRect(), rr = rail.getBoundingClientRect();
    bandY = (br.top - hr.top) / hr.height - 0.04;
    railBox = { x0: (rr.left - hr.left) / hr.width - 0.12, y1: (rr.bottom - hr.top) / hr.height + 0.06 };
    topY = innerWidth <= 991 ? (rr.bottom - hr.top) / hr.height + 0.03 : 0.14;
    avoid = [hint, proto].map((n) => {
      const r = n.getBoundingClientRect();
      return r.width ? { n, x0: (r.left - hr.left) / hr.width, x1: (r.right - hr.left) / hr.width, y0: (r.top - hr.top) / hr.height, y1: (r.bottom - hr.top) / hr.height } : null;
    }).filter(Boolean);
  };
  measureChrome();
  addEventListener('load', measureChrome);
  document.fonts?.ready.then(measureChrome);
  const inRail = (p) => railBox && p[0] > railBox.x0 && p[1] < railBox.y1 && innerWidth > 991;
  const hintShown = () => !document.documentElement.hasAttribute('data-scrolled') && motionOn();
  const blocked = (p) => avoid.some((o) => {
    if (o.n === hint && !hintShown()) return false;
    const lab = 250 / W(), pad = 30 / W(), padY = 30 / H(), toLeft = p[0] > 0.6;
    return p[0] > o.x0 - (toLeft ? pad : lab) && p[0] < o.x1 + (toLeft ? lab : pad) && p[1] > o.y0 - padY && p[1] < o.y1 + padY;
  });
  function updateSpots(anchors) {
    const k = Math.round(u), atStop = Math.abs(u - k) < 0.015;
    for (const el of spots) {
      const mine = +el.dataset.scene === k && atStop;
      const p = !mine ? null : anchors ? anchors[el.dataset.anchor] : stillSpot(el.dataset.anchor, k);
      const inside = p && p[0] * W() > 30 && p[0] * W() < W() - 30 && p[1] > topY && p[1] < bandY && !inRail(p) && !blocked(p);
      if (inside) { placeSpot(el, p); el.classList.add('is-on'); }
      else if (!el.querySelector('.spot__btn[aria-expanded="true"]') || !mine) { el.classList.remove('is-on'); if (!mine) closeCards(null, el); }
    }
  }
  function closeCards(except, only) {
    for (const el of only ? [only] : spots) {
      const b = el.querySelector('.spot__btn');
      if (b === except) continue;
      b.setAttribute('aria-expanded', 'false');
      el.querySelector('.spot__card').hidden = true;
    }
  }
  for (const el of spots) {
    const btn = el.querySelector('.spot__btn'), card = el.querySelector('.spot__card');
    el._btn = btn; el._card = card;
    btn.addEventListener('click', () => { const open = btn.getAttribute('aria-expanded') === 'true'; closeCards(btn); btn.setAttribute('aria-expanded', String(!open)); card.hidden = open; });
    el.querySelector('.spot__close').addEventListener('click', () => { closeCards(); btn.focus(); });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const open = hero.querySelector('.spot__btn[aria-expanded="true"]'); if (open) { closeCards(); open.focus(); } } });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.spot')) closeCards(); });

  // ---------- the live world ----------
  let L = null, building = false, failed = false, dpr = 1, maxDpr = 1, floorDpr = 1;
  const tier = pickTier();
  const size = () => [pin.clientWidth, pin.clientHeight];
  // the preloader's figure: the code, the files (most of the wait), the build, the shader programs
  const pct = loader.querySelector('.loader__pct'), bar = loader.querySelector('.loader__bar');
  let shown = 0, target = 0;
  const progress = (f) => { f = Math.max(shown, Math.min(1, f)); shown = f; pct.textContent = `${Math.round(f * 100)}%`; bar.style.setProperty('--p', f.toFixed(3)); };
  // the files are measured; building and compiling are not, so the bar creeps toward the end of each of those phases
  const creep = setInterval(() => { if (shown < target - 0.003) progress(shown + (target - shown) * 0.03); }, 100);
  const PHASE = { load: [0.06, 0.55], build: [0.55, 0.68], compile: [0.68, 0.97] };
  const onPhase = (phase, f) => {
    const [a, b] = PHASE[phase];
    const measured = phase === 'load'; // the files are counted; the build and the shader compile are not
    progress(measured ? a + (b - a) * f : f >= 1 ? b : a);
    target = measured ? (f >= 1 ? PHASE.build[1] : a + (b - a) * f) : f >= 1 ? (phase === 'build' ? PHASE.compile[1] : 0.99) : b;
  };
  async function build() {
    if (L || building || failed || !tier || !motionOn()) return;
    building = true;
    hero.classList.add('is-building');
    try {
      const [{ createLive }, f1, f2] = await Promise.all([
        import('../../world/live.js'),
        import('@fontsource-variable/big-shoulders-display/files/big-shoulders-display-latin-wght-normal.woff2?url'),
        import('@fontsource-variable/big-shoulders-display/files/big-shoulders-display-latin-ext-wght-normal.woff2?url'),
      ]);
      // the world paints its signs with the display face (KOLAUDIM, LINDJA STAR): it must be in before the textures
      for (const [url, range] of [[f1.default, 'U+0000-00FF'], [f2.default, 'U+0100-024F']]) {
        const ff = new FontFace('Big Shoulders Display', `url(${url})`, { weight: '100 900', unicodeRange: range });
        document.fonts.add(await ff.load());
      }
      progress(0.06);
      // sharp first: full resolution (more on fast GPUs and dense screens), and never below 0.85 on a desktop screen
      // or 1 on a phone; a slow GPU gives up frames before it gives up sharpness
      const fine = matchMedia('(pointer: fine)').matches;
      maxDpr = Math.min(devicePixelRatio || 1, tier === 'high' ? 1.75 : 1.5);
      floorDpr = Math.min(maxDpr, !fine ? 1 : tier === 'low' ? 0.7 : 0.85); // a weak desktop GPU: 0.7, smoothed by FXAA
      dpr = tier === 'low' ? Math.min(maxDpr, 0.8) : maxDpr;
      const [w, h] = size();
      L = await createLive({ canvas, width: w, height: h, dpr, tier, variant: phone() ? 'phone' : 'desktop', sky: '/live/sky_1k.hdr', skyGold: '/live/sky_golden_1k.hdr',
        onProgress: onPhase });
      await L.warm();
      await L.goldReady; // Tirana's sky too: nothing is still on its way when the site opens
      L.frame(u, gsap.ticker.time);
      clearInterval(creep); progress(1);
      variant = phone() ? 'phone' : 'desktop';
      hero.classList.add('is-live');
      settle = gsap.ticker.time + 2; // frames right after the reveal are not the steady cost
    } catch (e) {
      console.warn('live world', e); failed = true; L = null;
    } finally { building = false; hero.classList.remove('is-building'); }
  }
  let variant = null, settle = 0;
  // landing on the hero with a capable GPU: the preloader holds the site while the world downloads and builds, then
  // opens it ready (no half-built, low-resolution first view). Landing further down (a link to #makinat): no gate,
  // the world builds when the hero comes near.
  const gate = !!tier && motionOn() && window.scrollY < hero.offsetTop + hero.offsetHeight - innerHeight;
  if (gate) {
    lenis.stop();
    build().finally(() => lift());
    setTimeout(() => lift(), 45000); // a very slow line still gets in; the world joins when it is ready
  } else {
    const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { io.disconnect(); (window.requestIdleCallback || setTimeout)(() => build(), { timeout: 1200 }); } }, { rootMargin: '100% 0px' });
    io.observe(hero);
  }
  addEventListener('resize', () => {
    measureChrome();
    if (!L) return;
    const v = phone() ? 'phone' : 'desktop';
    if (v !== variant) { location.reload(); return; } // the phone and desktop routes frame differently: rebuild cleanly
    const [w, h] = size(); L.resize(w, h, dpr);
  });

  // adaptive resolution: a slow GPU steps down (to half), a fast one back up toward the device ratio
  const times = [];
  function adapt(dt) {
    if (gsap.ticker.time < settle) return;
    times.push(dt);
    if (times.length < 45) return;
    const avg = times.reduce((a, b) => a + b, 0) / times.length; times.length = 0;
    // under ~25 fps the resolution steps down, but only to the floor; well over 60 it steps back up
    let next = dpr;
    if (avg > 40) next = Math.max(floorDpr, dpr * 0.9);
    else if (avg < 13 && dpr < maxDpr) next = Math.min(maxDpr, dpr * 1.1);
    if (Math.abs(next - dpr) > 0.01) { dpr = +next.toFixed(3); const [w, h] = size(); L.resize(w, h, dpr); settle = gsap.ticker.time + 0.6; }
    if (dpr <= floorDpr && avg > 45) L.setReflection(false);
  }

  // ---------- one clock ----------
  let lastStep = -1;
  gsap.ticker.add((time, dt) => {
    const s = sNow();
    if (s > 1.02 && lastStep !== -1) return; // below the hero: nothing to draw
    u = uFromS(s);
    const k = Math.round(u);
    if (k !== step || lastStep === -1) { step = k; setLabels(k, lastStep !== -1); if (!L || !motionOn()) showStill(k); }
    lastStep = step;
    if (u > 0.04) document.documentElement.setAttribute('data-scrolled', '');
    paintRail();
    if (L && motionOn()) {
      L.frame(u, time);
      adapt(dt);
      updateSpots(L.anchors(spots.filter((el) => +el.dataset.scene === k).map((el) => el.dataset.anchor)));
    } else updateSpots(null);
  });
  document.addEventListener('motionchange', () => {
    hero.classList.toggle('is-live', !!L && motionOn());
    showStill(Math.round(u));
    if (motionOn() && !L) build();
  });

  // ---------- loading: the still is the first view; the loader lifts as soon as it is painted ----------
  const lift = () => { if (loader.classList.contains('is-done')) return; clearInterval(creep); loader.classList.add('is-done'); lenis.start(); measureChrome(); intro(); };
  function intro() {
    if (!motionOn()) return;
    const up = [hero.querySelector('.hero__place'), hero.querySelector('#hero-h1'), hero.querySelector('.hero__lead')];
    const taps = hero.querySelectorAll('.cta-row .btn, .hero__rail li, .rail__tools > :not([hidden])');
    gsap.timeline({ delay: 0.1 })
      .fromTo(wordBox.querySelector('.hero__word-in'), { yPercent: 105 }, { yPercent: 0, duration: 1.1, ease: 'expo.out' }, 0)
      .fromTo(up, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07, clearProps: 'transform' }, 0.1)
      .fromTo(taps, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.035, clearProps: 'opacity' }, 0.3);
  }
  loader.querySelector('.loader__skip').addEventListener('click', lift); // in now: the world fades in when it is built
  if (!gate) { if (posterImg.complete) lift(); else { posterImg.addEventListener('load', lift, { once: true }); setTimeout(lift, 2500); } }
  showStill(step);
  setLabels(step, false);
  app.heroWorld = () => L; // tests and the console
}
