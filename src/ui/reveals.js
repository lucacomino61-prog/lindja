// Scroll reveals below the film, on GSAP's one ticker: headings rise word by word out of their own mask, copy
// and pictures follow, the car cards come in by rows, the guides' rules draw, the transporter and the ship move
// with the scroll and the footer's wordmark lands letter by letter. Tap targets only fade, never move under a
// finger. Created after the import strip's pin, so every start position includes its spacer. Stopping motion
// finishes every reveal and parks every scroll-linked picture.
export function initReveals(app) {
  const { gsap, ScrollTrigger } = app;
  if (!app.motionOn() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const once = (trigger, start = 'top 88%') => ({ trigger, start, once: true });
  const reveals = [], scrubs = [];
  const reveal = (targets, from, to, trigger, start) => {
    const t = gsap.fromTo(targets, from, { ...to, lazy: false, scrollTrigger: once(trigger, start) });
    reveals.push(t);
    return t;
  };
  const scrub = (target, from, to, trigger) => {
    scrubs.push(gsap.fromTo(target, from, { ...to, ease: 'none', scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: 0.6 } }));
  };

  // ---------- headings: each word in a mask that reaches past its box (Ë above, Ç below), removed on landing ----------
  const split = (el) => {
    const walk = (node) => {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 1) { walk(n); continue; }
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const frag = document.createDocumentFragment();
        for (const part of n.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(part); continue; }
          const w = document.createElement('span');
          const inner = document.createElement('span');
          w.className = 'w';
          inner.textContent = part;
          w.append(inner);
          frag.append(w);
        }
        n.replaceWith(frag);
      }
    };
    walk(el);
    return el.querySelectorAll('.w > span');
  };
  const heads = [...document.querySelectorAll('main h2, .sr__city, .guide__k')];
  for (const h of heads) {
    reveal(split(h), { yPercent: 130 }, { yPercent: 0, duration: 1.05, ease: 'expo.out', stagger: 0.06, onComplete: () => h.classList.add('is-landed') }, h);
  }

  // ---------- copy follows its heading ----------
  const copy = '.manifest__text, .catalogue__head p, .route__head p, .order__intro p, .finance__intro p, .quote__intro p, .quote__steps, .sr__role, .sr__meta, .guide h3, .guide p:last-child, .calc__out';
  for (const el of document.querySelectorAll(copy)) {
    reveal(el, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, delay: 0.12, ease: 'expo.out', clearProps: 'transform' }, el, 'top 94%');
  }
  // anything holding controls or links fades in place
  for (const el of document.querySelectorAll('.filters, .catalogue__bar, .mform, .calc, .site-footer__grid, .site-footer__legal')) {
    reveal(el, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power2.out', clearProps: 'opacity' }, el, 'top 94%');
  }

  // ---------- car cards: a row at a time; the card fades (its buttons stay put), the car drives in ----------
  const cars = gsap.utils.toArray('.car__in');
  const carPics = cars.map((c) => c.querySelector('.car__img img'));
  gsap.set(cars, { opacity: 0 });
  gsap.set(carPics, { xPercent: 12, opacity: 0 });
  const showCars = (els, quick) => {
    gsap.to(els, { opacity: 1, duration: quick ? 0.3 : 0.6, ease: 'power2.out', stagger: quick ? 0 : 0.07, overwrite: true, clearProps: 'opacity' });
    gsap.to(els.map((c) => c.querySelector('.car__img img')), { xPercent: 0, opacity: 1, duration: quick ? 0.6 : 1.1, ease: 'expo.out', stagger: quick ? 0 : 0.07, overwrite: true, clearProps: 'transform,opacity' });
  };
  const batch = ScrollTrigger.batch(cars, { start: 'top 94%', once: true, onEnter: (els) => showCars(els) });
  app.onCarsShown = (lis) => showCars(lis.map((li) => li.querySelector('.car__in')), true); // filtered back in before its row was reached

  // ---------- pictures ----------
  for (const img of document.querySelectorAll('.sr img')) {
    reveal(img, { clipPath: 'inset(0% 0% 100% 0% round 4px)' }, { clipPath: 'inset(0% 0% 0% 0% round 4px)', duration: 1.4, ease: 'expo.out', clearProps: 'clipPath' }, img, 'top 90%');
  }
  gsap.matchMedia().add('(max-width: 991px)', () => {
    for (const box of document.querySelectorAll('.leg__img')) {
      reveal(box, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out', clearProps: 'clipPath' }, box, 'top 90%');
    }
  });
  const truck = document.querySelector('.manifest__truck');
  if (truck && innerWidth > 560) scrub(truck, { x: '30vw' }, { x: '-80vw' }, '.manifest');
  const ship = document.querySelector('.order__intro img');
  if (ship) scrub(ship, { xPercent: -10 }, { xPercent: 10 }, '.order');

  // ---------- guides: the rules draw left to right, one after another ----------
  document.querySelectorAll('.guide__rule').forEach((r, i) => {
    reveal(r, { scaleX: 0 }, { scaleX: 1, duration: 1.2, delay: (i % 3) * 0.12, ease: 'expo.out' }, r, 'top 92%');
  });

  // ---------- footer wordmark: the letters land one by one ----------
  const mark = document.querySelector('.site-footer__mark');
  if (mark) {
    const letters = [...mark.textContent].map((ch) => { const s = document.createElement('span'); s.textContent = ch; return s; });
    mark.replaceChildren(...letters);
    reveal(letters, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.06 }, mark, 'top 90%');
  }

  // ---------- Stop motion: everything lands now, nothing follows the scroll ----------
  document.addEventListener('motionchange', () => {
    if (app.motionOn()) return;
    for (const t of reveals) { t.scrollTrigger?.kill(); t.progress(1); }
    for (const t of scrubs) { t.scrollTrigger?.kill(); t.revert(); }
    batch.forEach((st) => st.kill());
    gsap.killTweensOf([...cars, ...carPics]);
    gsap.set([...cars, ...carPics], { clearProps: 'opacity,transform' });
    heads.forEach((h) => h.classList.add('is-landed'));
  });
}
