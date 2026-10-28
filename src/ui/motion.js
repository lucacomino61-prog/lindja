// The visible "Stop motion" switch: stops the film, scroll smoothing and every scroll-linked effect.
export function initMotion(app) {
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll('.motion-toggle')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const paint = () => {
    const off = root.dataset.motion === 'off';
    for (const b of buttons) {
      b.setAttribute('aria-pressed', String(off));
      b.querySelector('span').textContent = off ? b.dataset.labelStart : b.dataset.labelStop;
    }
    app.lenis.options.smoothWheel = !off;
  };
  const set = (off) => {
    root.dataset.motion = off ? 'off' : 'on';
    try { localStorage.setItem('lindja-motion', off ? 'off' : 'on'); } catch {}
    paint();
    document.dispatchEvent(new CustomEvent('motionchange'));
  };
  buttons.forEach((b) => b.addEventListener('click', () => set(root.dataset.motion !== 'off')));
  reduced.addEventListener('change', () => set(reduced.matches));
  paint();
  app.motionOn = () => root.dataset.motion !== 'off';
}
