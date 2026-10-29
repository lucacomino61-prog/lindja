// The 404 page's one toy: the digits lean toward the pointer, and the orange car drives along the road under them
// to wherever the pointer (or a finger, or the arrow keys) is. A click on the car makes it honk. One small rAF loop
// is this page's only animation; with reduced motion or the site's Stop switch the car just stands still.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches || (() => { try { return localStorage.getItem('lindja-motion') === 'off'; } catch { return false; } })();
const code = document.querySelector('.nf__code');
const road = document.querySelector('.nf__road');
const car = document.querySelector('.nf__car');
const honk = document.querySelector('.nf__honk');
const lines = ['Bip bip! Kjo rrugë nuk të çon askund.', 'Bip! Provo kërkimin më poshtë.', 'Biiip! Makinat janë në faqen kryesore.'];
let n = 0;

if (car && road) {
  let x = 0.5, target = 0.5, face = 1, lean = { x: 0, y: 0 }, leanTarget = { x: 0, y: 0 }, raf = 0;
  const place = () => {
    const w = road.clientWidth - car.offsetWidth;
    car.style.transform = `translateX(${(x * w).toFixed(1)}px) scaleX(${face})`;
    if (code) code.style.transform = `perspective(900px) rotateX(${lean.y.toFixed(2)}deg) rotateY(${lean.x.toFixed(2)}deg)`;
  };
  const tick = () => {
    const dx = target - x;
    if (Math.abs(dx) > 0.002) face = dx < 0 ? -1 : 1; // the car looks where it drives
    x += dx * 0.06;
    lean.x += (leanTarget.x - lean.x) * 0.08;
    lean.y += (leanTarget.y - lean.y) * 0.08;
    place();
    raf = Math.abs(dx) > 0.0005 || Math.abs(leanTarget.x - lean.x) > 0.01 || Math.abs(leanTarget.y - lean.y) > 0.01 ? requestAnimationFrame(tick) : 0;
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const aim = (clientX, clientY) => {
    const r = road.getBoundingClientRect();
    target = Math.min(1, Math.max(0, (clientX - r.left - car.offsetWidth / 2) / (r.width - car.offsetWidth)));
    leanTarget = { x: ((clientX / innerWidth) - 0.5) * 14, y: -((clientY / innerHeight) - 0.5) * 10 };
    go();
  };
  place();
  if (!still) {
    addEventListener('pointermove', (e) => aim(e.clientX, e.clientY), { passive: true });
    addEventListener('resize', place);
  }
  // keys move it a step at a time, with or without motion
  car.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    target = Math.min(1, Math.max(0, target + (e.key === 'ArrowLeft' ? -0.1 : 0.1)));
    if (still) { face = e.key === 'ArrowLeft' ? -1 : 1; x = target; place(); } else go();
  });
  car.addEventListener('click', () => {
    honk.textContent = lines[n++ % lines.length];
    if (still) return;
    car.classList.remove('is-honking');
    void car.offsetWidth;
    car.classList.add('is-honking');
  });
}
